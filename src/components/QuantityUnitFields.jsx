import { useId } from 'react';
export const COMMON_UNITS = ['', 'each', 'g', 'kg', 'ml', 'L', 'oz', 'lb', 'cup', 'pack', 'bag', 'box', 'bottle', 'carton', 'can', 'jar', 'loaf', 'dozen'];
export default function QuantityUnitFields({quantity,unit='',onChange}) {
  const id=useId();
  return <div className="setup-quantity-fields">
    <label htmlFor={`${id}-qty`}>Quantity<input id={`${id}-qty`} type="number" inputMode="decimal" min="0.01" step="any" required value={quantity} onChange={e=>onChange({quantity:e.target.value===''?'':Number(e.target.value)})}/></label>
    <label htmlFor={`${id}-unit`}>Unit<select id={`${id}-unit`} value={unit} onChange={e=>onChange({unit:e.target.value})}>{(COMMON_UNITS.includes(unit)?COMMON_UNITS:[...COMMON_UNITS,unit]).map(value=><option key={value} value={value}>{value||'No unit'}</option>)}</select></label>
  </div>;
}
