import RootLayoutBase from '../components/RootLayoutBase';

export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <RootLayoutBase>{children}</RootLayoutBase>;
}

