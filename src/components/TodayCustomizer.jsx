import { ArrowDown, ArrowUp, RotateCcw } from './icons';
import { Modal } from './ui';

export default function TodayCustomizer({ open, onClose, cards, hidden, onToggle, onMove, onReset }) {
  return <Modal open={open} onClose={onClose} title="Customize Today">
    <p className="today-editor-intro">Choose what you see and arrange it in the order that works for you. Changes save on this device.</p>
    <div className="today-editor-list">{cards.map((card, index) => {
      const visible = !hidden.includes(card.id);
      return <div className="today-editor-row" key={card.id}>
        <label><input type="checkbox" role="switch" checked={visible} onChange={() => onToggle(card.id)}/><span>{card.label}<small>{visible ? 'Shown' : 'Hidden'}</small></span></label>
        <div className="today-editor-move"><button type="button" disabled={index === 0} onClick={() => onMove(card.id, -1)} aria-label={`Move ${card.label} earlier`}><ArrowUp size={17}/></button><button type="button" disabled={index === cards.length - 1} onClick={() => onMove(card.id, 1)} aria-label={`Move ${card.label} later`}><ArrowDown size={17}/></button></div>
      </div>;
    })}</div>
    <div className="today-editor-actions"><button type="button" onClick={onReset}><RotateCcw size={15}/> Reset</button><button type="button" onClick={onClose}>Done</button></div>
  </Modal>;
}
