import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // A biblioteca do Excel roda direto no Node, sem passar pelo empacotador.
  serverExternalPackages: ['exceljs'],
};

export default nextConfig;
