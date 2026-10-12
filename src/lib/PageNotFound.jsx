import NotFoundContent from '@/components/exmortis/NotFoundContent';
import { useNoIndex } from '@/lib/useNoIndex';
import { useDocMeta } from '@/lib/useDocMeta';

export default function PageNotFound() {
  useNoIndex();
  useDocMeta('Nie ma takiej strony — exmortis', 'Tej strony nie ma albo zmieniła adres.');
  return <NotFoundContent />;
}