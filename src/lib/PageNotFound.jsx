import NotFoundContent from '@/components/exmortis/NotFoundContent';
import { useNoIndex } from '@/lib/useNoIndex';

export default function PageNotFound() {
  useNoIndex();
  return <NotFoundContent />;
}