import Menu from '@/components/Menu';

export const dynamic = 'force-dynamic';

export default function LayoutDP({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Menu />
      <main className="dp-conteudo">{children}</main>
    </>
  );
}
