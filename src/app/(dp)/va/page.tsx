import PaginaBeneficio from '@/components/PaginaBeneficio';

export default async function Page({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  return <PaginaBeneficio tipo="va" mes={mes} />;
}
