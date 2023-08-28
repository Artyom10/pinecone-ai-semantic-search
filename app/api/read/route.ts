import { indexName } from '@/config';
import { queryPineconeVectorStoreAndQueryLLM } from '@/utils';
import { PineconeClient } from '@pinecone-database/pinecone';
import { NextRequest, NextResponse } from 'next/server';

export const POST = async (request: NextRequest) => {
    const body = await request.json();
    const client = new PineconeClient();

    await client.init({
        apiKey: process.env.PINECONE_API_KEY || '',
        environment: process.env.PINECONE_ENVIRONMENT || '',
    });

    const text = await queryPineconeVectorStoreAndQueryLLM(client, indexName, body);

    return NextResponse.json({
        data: text,
    });
};
