// A household member must explicitly attest to consent for each invitation SMS.
export function canSendInvitationSms({wantsSms, phone, consent}) {
  return !wantsSms || !phone || consent === true;
}
export function canSendTestSms({phone, verifiedPhone, phoneConfirmed}) {
  const candidate=String(phone || '').replace(/[^\d+]/g,'');
  return /^\+?\d{10,15}$/.test(candidate) && Boolean(phoneConfirmed) && String(verifiedPhone || '').replace(/\D/g,'') === candidate.replace(/\D/g,'');
}
