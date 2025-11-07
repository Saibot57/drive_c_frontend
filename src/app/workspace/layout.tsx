import DefaultContainer from '../components/DefaultContainer';

export default function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DefaultContainer>{children}</DefaultContainer>;
}
