'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

export default function Home() {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const createIndexAndEmbeddings = async () => {
        try {
            const result = await fetch('/api/setup', {
                method: 'POST',
            });

            const json = await result.json();
            console.log(json);
        } catch (error) {
            console.log(error);
        }
    };

    const sendQuery = async () => {
        if (!query) {
            return;
        }
        setResult('');
        setIsLoading(true);

        try {
            const result = await fetch('/api/read', {
                method: 'POST',
                body: JSON.stringify(query),
            });
            const json = await result.json();
            setResult(json.data);
        } catch (error) {
            console.log(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="flex flex-col items-center justify-between p-24">
            <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="text-black px-2 py-1 w-1/4"
            />
            <div className="py-5 border-green-500">
                <Button onClick={sendQuery}>Ask AI</Button>
            </div>

            {isLoading && <p>Asking AI ...</p>}
            {result && <p>{result}</p>}
            <Button variant="outline" onClick={createIndexAndEmbeddings}>
                Create index and embeddings
            </Button>
        </main>
    );
}
