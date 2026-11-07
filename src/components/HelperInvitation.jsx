import { useState } from 'react';
import { Link2, Mail, MessageCircle, Share2 } from './icons';
import { Modal, SecondaryButton, TextField } from './ui';

export default function HelperInvitation({ link, email, onClose }) {
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const title='Your FamOS helper invitation';
  const text=`You’re invited to a limited shared space in FamOS. Sign in with ${email} to review and accept the invitation. The family chooses what you can access and can revoke it at any time.`;
  const message=`${text}\n\n${link}`;
  const copy=async()=>{
    try {await navigator.clipboard.writeText(message);setStatus('Invitation copied. Paste it into a private message.');}
    catch {setStatus('Could not copy automatically. Select and copy the invitation link below.');}
  };
  const share=async()=>{
    if(busy)return;
    setBusy(true);setStatus('');
    try {await navigator.share({title,text,url:link});}
    catch(error){if(error?.name!=='AbortError')setStatus('Could not open sharing. Use email, text message or copy the link.');}
    finally {setBusy(false);}
  };
  return <Modal open={!!link} title="Invitation ready" onClose={onClose}><div className="family-helper-form">
    <p>Share privately by email or text. Your helper must sign in with <strong>{email}</strong> to accept. Sending the link does not grant access by itself.</p>
    <div className="share-sheet-actions">
      <a className="share-sheet-action" href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(message)}`}><Mail size={18}/><span>Share by email</span></a>
      <a className="share-sheet-action" href={`sms:?&body=${encodeURIComponent(message)}`}><MessageCircle size={18}/><span>Share by text message</span></a>
      {typeof navigator.share==='function'&&<SecondaryButton disabled={busy} onClick={share}><Share2 size={18}/> More sharing options</SecondaryButton>}
      <SecondaryButton onClick={copy}><Link2 size={18}/> Copy invitation</SecondaryButton>
    </div>
    <p className="family-helper-note">Email and text open a draft in your chosen app. Review the recipient and send it there. FamOS does not send the message automatically.</p>
    {status&&<p role="status">{status}</p>}
    <TextField label="Invitation link" readOnly value={link}/>
    <p>This link is shown only now. If it is lost, revoke the pending invitation and create a new one.</p>
  </div></Modal>;
}
