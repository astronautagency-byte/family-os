export async function registerPushDevice({client,userId,publicKey,timeoutMs=10000}) {
  if (!userId) throw new Error('Sign in to enable background notifications.');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Background Web Push is not supported here. On iPhone, open the Home Screen-installed web app. Native app reminders need a separate setup.');
  }
  let timer;
  try {
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('The notification service is not ready. Reload the app and retry.')),timeoutMs);}),
    ]);
    let subscription=await registration.pushManager.getSubscription();
    if(!subscription) subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKey});
    const {error}=await client.from('push_subscriptions').upsert({user_id:userId,endpoint:subscription.endpoint,subscription:subscription.toJSON(),device_label:navigator.userAgentData?.platform || navigator.platform || 'Browser'},{onConflict:'user_id,endpoint'});
    if(error) throw error;
    return subscription.endpoint;
  } finally { clearTimeout(timer); }
}
