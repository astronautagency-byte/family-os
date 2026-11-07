/** Replace the pending event and any realtime copy with one confirmed record. */
export function reconcileCreatedEvent(events, optimisticId, savedEvent) {
  const result=[];let inserted=false;
  for(const event of events){
    if(event.id===optimisticId || event.id===savedEvent.id){if(!inserted){result.push(savedEvent);inserted=true;}}
    else result.push(event);
  }
  if(!inserted)result.push(savedEvent);
  return result;
}
