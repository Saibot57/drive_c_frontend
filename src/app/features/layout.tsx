import DefaultContainer from '../components/DefaultContainer';

export default function FeaturesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DefaultContainer>{children}</DefaultContainer>;
}
