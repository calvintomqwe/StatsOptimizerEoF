import React from 'react';
import StatsForm from '@/components/StatsForm';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-900 py-8">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-white">EoF stats preview tool</h1>
        <StatsForm />
      </div>
    </main>
  );
}
