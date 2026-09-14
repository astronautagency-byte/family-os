export function notificationFeature(notification={}) {
 const route=String(notification.url || notification.data?.url || '').replace(/^.*#\/?/,'').replace(/^\//,'').split(/[?/#]/)[0];
 if(['calendar','tasks','groceries','kitchen','meals','recipes','rewards','chat'].includes(route))return route;
 const tag=String(notification.tag || '');
 return tag.startsWith('kitchen-')?'kitchen':null;
}
export function reminderPaused(preferences,notification) {
 const feature=notificationFeature(notification);
 return !!feature && preferences?.pause_reminders===true && preferences?.features?.[feature]===false;
}
