import { RootLayoutBase } from '../layout';

export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <RootLayoutBase>{children}</RootLayoutBase>;
}
