"use client";

import { Suspense } from 'react';
import VisualizationContent from './VisualizationContent';

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading visualization...</p>
      </div>
    </div>
  );
}

export default function VisualizationPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <VisualizationContent />
    </Suspense>
  );
}
