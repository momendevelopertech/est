export default function PublicLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="w-full">{children}</div>
    </div>
  );
}
