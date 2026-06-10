export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-12">
      {children}
    </div>
  );
}
