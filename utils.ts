import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAI } from 'langchain/llms/openai';
import { loadQAStuffChain } from 'langchain/chains';
import { Document } from 'langchain/document';
import { PineconeClient, ScoredVector, Vector } from '@pinecone-database/pinecone';
import { timeout } from './config';

interface ScoredVectorWithContent extends ScoredVector {
    pageContent: string;
}

export const createPineconeIndex = async (
    client: PineconeClient,
    indexName: string,
    vectorDimension: number
) => {
    console.log(indexName);

    const existingIndexes = await client.listIndexes();

    if (!existingIndexes.includes(indexName)) {
        await client.createIndex({
            createRequest: {
                name: indexName,
                dimension: vectorDimension,
                metric: 'cosine',
            },
        });

        await new Promise((resolve) => setTimeout(resolve, timeout));
    }
};

export const updatePinecone = async (
    client: PineconeClient,
    indexName: string,
    docs: Document[]
) => {
    const index = client.Index(indexName);

    for (const doc of docs) {
        const txtPath = doc.metadata.source;
        const text: string = doc.pageContent;

        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
        });

        const chunks = await textSplitter.createDocuments([text]);

        const embeddingsArrays = await new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
        }).embedDocuments(chunks.map((chunk) => chunk.pageContent.replace(/\n/g, ' ')));

        const batchSize = 100;
        let batch: Vector[] = [];

        for (let idx = 0; idx < chunks.length; idx++) {
            const chunk = chunks[idx];
            const vector = {
                id: `${txtPath}_${idx}`,
                values: embeddingsArrays[idx],
                metadata: {
                    ...chunk.metadata,
                    loc: JSON.stringify(chunk.metadata.loc),
                    pageContent: chunk.pageContent,
                    txtPath: txtPath,
                },
            };
            batch = [...batch, vector];
            if (batch.length === batchSize || idx === chunks.length - 1) {
                await index.upsert({
                    upsertRequest: {
                        vectors: batch,
                    },
                });
                batch = [];
            }
        }
    }
};

export const queryPineconeVectorStoreAndQueryLLM = async (
    client: PineconeClient,
    indexName: string,
    question: string
) => {
    const index = client.Index(indexName);

    const queryEmbedding = await new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
    }).embedQuery(question);

    const queryResponse = await index.query({
        queryRequest: {
            topK: 10,
            vector: queryEmbedding,
            includeMetadata: true,
            includeValues: true,
        },
    });

    if (queryResponse.matches?.length) {
        const llm = new OpenAI({});
        const chain = loadQAStuffChain(llm);

        const concatenatedPageContent = queryResponse.matches
            .map((match) => (match.metadata as ScoredVectorWithContent)?.pageContent)
            .join(' ');

        const result = await chain.call({
            input_documents: [new Document({ pageContent: concatenatedPageContent })],
            question,
        });

        return result.text;
    } else {
        console.log('There are no matches');
    }
};
