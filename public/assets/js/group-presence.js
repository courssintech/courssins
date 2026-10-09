import { esc, fmtDate } from './ui.js';

export function joinGroupPresence(supabase, groupId, me, onChange) {
  let heartbeat;
  let tracked = false;
  const channel = supabase.channel(`course-group-presence-${groupId}`, { config: { private: true, presence: { key: me.id } } });
  channel.on('presence', { event: 'sync' }, () => onChange(channel.presenceState()));
  channel.subscribe(async (status) => {
    if (status !== 'SUBSCRIBED') return;
    await channel.track({ user_id: me.id, full_name: me.full_name || 'Course member', typing: false });
    if (tracked) return;
    tracked = true;
    const touch = () => supabase.rpc('touch_tutor_group_presence', { p_group: groupId });
    await touch();
    heartbeat = setInterval(touch, 45000);
  });
  return {
    channel,
    trackTyping(typing) {
      return channel.track({ user_id: me.id, full_name: me.full_name || 'Course member', typing: Boolean(typing) });
    },
    async stop() {
      clearInterval(heartbeat);
      await supabase.rpc('touch_tutor_group_presence', { p_group: groupId });
      await supabase.removeChannel(channel);
    },
  };
}

export async function loadGroupMembers(supabase, groupId) {
  const { data, error } = await supabase.rpc('get_tutor_group_members', { p_group: groupId });
  return { members: data || [], error };
}

export function renderGroupMembers(members, presence, target, onCount = () => {}) {
  if (!target) return;
  const priorScroll = target.scrollTop;
  const onlineIds = new Set(Object.values(presence || {}).flat().filter((state) => state.user_id).map((state) => state.user_id));
  const people = members || [];
  onCount(people.length, people.filter((person) => onlineIds.has(person.user_id)).length);
  target.innerHTML = people.length ? people.map((member) => {
      const online = onlineIds.has(member.user_id);
      const initial = esc((member.full_name || 'M').trim().slice(0, 1).toUpperCase());
      const avatarUrl = /^https?:\/\//i.test(member.avatar_url || '') ? esc(member.avatar_url) : '';
      const avatar = avatarUrl ? `<img src="${avatarUrl}" alt="">` : `<span>${initial}</span>`;
      const state = online ? '<span class="member-presence is-online"><i></i>Online</span>' : `<span class="member-presence"><i></i>${member.last_seen_at ? `Last seen ${esc(fmtDate(member.last_seen_at, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }))}` : 'Not seen yet'}</span>`;
      return `<li class="group-member">${avatar}<span class="group-member-name"><strong>${esc(member.full_name || 'Course member')}</strong><small>${esc(member.role === 'tutor' ? 'Course tutor' : member.role === 'student' ? 'Student' : 'Staff')}</small></span>${state}</li>`;
  }).join('') : '<li class="muted">No active members found.</li>';
  target.scrollTop = priorScroll;
}

export function renderTypingIndicator(target, presence, me) {
  if (!target) return;
  const typers = Object.values(presence || {}).flat().filter((state) => state.user_id !== me.id && state.typing).map((state) => state.full_name || 'A member');
  target.hidden = !typers.length;
  target.innerHTML = typers.length ? `<span class="typing"><i></i><i></i><i></i></span><span>${typers.map(esc).join(', ')} ${typers.length === 1 ? 'is' : 'are'} typing</span>` : '';
}
