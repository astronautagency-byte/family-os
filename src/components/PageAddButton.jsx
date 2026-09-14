import { Plus } from 'lucide-react';
export default function PageAddButton({ label, onClick }) {
  return <button type="button" className="page-add-button" onClick={onClick} aria-label={label} title={label}><Plus size={22}/><span>{label}</span></button>;
}
