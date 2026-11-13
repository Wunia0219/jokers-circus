export const ANNOUNCEMENT_LAUNCH_ID = 'casino:open-game';

export function withAnnouncementLaunch(message) {
  if (!message.embeds?.length) return message;
  return {
    ...message,
    components: [
      ...(message.components ?? []),
      {type: 1, components: [{type: 2, style: 2, label: '開啟遊戲', custom_id: ANNOUNCEMENT_LAUNCH_ID}]},
    ],
  };
}
