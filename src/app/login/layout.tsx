import DefaultContainer from '../components/DefaultContainer';

export default function LoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DefaultContainer>{children}</DefaultContainer>;
}
