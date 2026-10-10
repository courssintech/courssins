import { esc, fmtDate, icon, toast } from './ui.js';

const safeName = (name) => String(name || 'attachment').replace(/[^a-z0-9._-]/gi, '_').slice(-120);
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?';
const dateLabel = (date) => new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(date));
const safeHref = (value) => /^(https?:\/\/|\/(?!\/)|[a-z0-9_.-]+\.html(?:[?#]|$))/i.test(String(value || '')) ? esc(String(value)) : '#';

export async function mountMessaging({ root, supabase, me, requestedId = null }) {
  let inbox = [], contacts = [], activeId = requestedId, activeChannel = null, liveChannel = null, oldest = null, filter = 'all', search = '', loadingMore = false, messageMatches = null, searchTimer = null, typingTimer = null, retryNonce = null;
  const escAttr = (value) => esc(value);
  const avatar = (name, url, cls = '') => `<span class="messenger-avatar ${cls}">${url ? `<img src="${escAttr(url)}" alt="" loading="lazy">` : esc(initials(name))}</span>`;
  const removeActiveChannel = async () => {
    if (activeChannel) { await supabase.removeChannel(activeChannel); activeChannel = null; }
  };
  const removeChannels = async () => {
    await removeActiveChannel();
    if (liveChannel) { await supabase.removeChannel(liveChannel); liveChannel = null; }
  };
  const reloadInbox = async () => {
    const { data, error } = await supabase.rpc('messaging_inbox');
    if (error) { toast(`Inbox could not refresh: ${error.message}`, 'err'); return false; }
    inbox = data || [];
    const badge = document.querySelector('[data-badge="messages"], [data-badge="staff-inbox"]');
    if (badge) { const unread = inbox.reduce((total, row) => total + Number(row.unread_count || 0), 0); badge.hidden = !unread; badge.textContent = unread > 99 ? '99+' : String(unread || ''); }
    if (activeId && !inbox.some((item) => item.conversation_id === activeId)) activeId = null;
    return true;
  };
  const filtered = () => inbox.filter((item) => (filter === 'archived' ? item.archived : !item.archived && (filter === 'all' || (filter === 'unread' ? Number(item.unread_count) > 0 : filter === 'read' ? Number(item.unread_count) === 0 : item.other_role === filter))) && (!search || `${item.other_name} ${item.course_title || ''} ${item.last_body || ''}`.toLowerCase().includes(search) || messageMatches?.has(item.conversation_id)));
  const threadRowsHTML = () => filtered().map((item) => `<button type="button" class="messenger-thread ${item.conversation_id === activeId ? 'active' : ''}" data-open-conversation="${item.conversation_id}">${avatar(item.other_name,item.other_avatar)}<span class="messenger-preview"><strong>${esc(item.other_name || 'Former user')}</strong><small>${esc(item.last_body || (item.course_title ? `Started · ${item.course_title}` : 'No messages yet'))}</small></span><span class="thread-meta"><time>${fmtDate(item.last_at,{hour:'numeric',minute:'2-digit'})}</time>${Number(item.unread_count) ? `<b class="unread-count">${Number(item.unread_count)}</b>` : ''}</span></button>`).join('') || '<div class="messenger-empty">No conversations match this view.</div>';
  const sidebarHTML = () => `<aside class="messenger-inbox"><header class="messenger-head"><div><span class="eyebrow">COURSSINS MESSAGES</span><h2>Inbox</h2></div><button type="button" class="btn btn-lime btn-sm" data-new-chat>New chat</button></header><div class="message-search"><label class="sr-only" for="messageSearch">Search conversations</label><input id="messageSearch" class="input" type="search" value="${escAttr(search)}" placeholder="Search conversations"></div><div class="message-filters" role="group" aria-label="Filter conversations"><button data-filter="all" class="${filter === 'all' ? 'active' : ''}">All</button><button data-filter="unread" class="${filter === 'unread' ? 'active' : ''}">Unread</button><button data-filter="read" class="${filter === 'read' ? 'active' : ''}">Read</button><button data-filter="archived" class="${filter === 'archived' ? 'active' : ''}">Archived</button></div><div class="messenger-threads" id="conversationList" aria-label="Conversations">${threadRowsHTML()}</div></aside>`;
  const refreshConversationList = () => {
    const list = root.querySelector('#conversationList'); if (!list) return;
    list.innerHTML = threadRowsHTML();
    list.querySelectorAll('[data-open-conversation]').forEach((button) => button.addEventListener('click', () => selectConversation(button.dataset.openConversation)));
  };

  async function loadMessages(conversationId, before = null) {
    let query = supabase.from('conversation_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50);
    if (before) query = query.lt('created_at', before);
    const { data, error } = await query;
    if (error) {
      toast(`Could not load messages: ${error.message}`, 'err');
      const box = root.querySelector('#messageItems');
      if (box) { box.innerHTML = `<div class="alert err">Could not load this conversation.</div><button type="button" class="btn btn-outline btn-sm" data-retry-messages>Try again</button>`; box.querySelector('[data-retry-messages]')?.addEventListener('click', () => render()); }
      return null;
    }
    const messages = (data || []).reverse();
    if (messages.length) oldest = messages[0].created_at;
    return messages;
  }
  async function messageHTML(messages, item) {
    const paths = messages.filter((message) => message.attachment_path).map((message) => message.attachment_path);
    const signed = new Map();
    if (paths.length) {
      const { data } = await supabase.storage.from('message-attachments').createSignedUrls(paths, 3600);
      (data || []).forEach((asset, index) => signed.set(paths[index], asset.signedUrl || ''));
    }
    let previousDate = '', unreadAdded = false;
    return messages.map((message) => {
      const day = dateLabel(message.created_at); const divider = day !== previousDate ? `<div class="message-day"><span>${esc(day)}</span></div>` : ''; previousDate = day;
      const mine = message.sender_id === me.id;
      const unreadDivider = !mine && !unreadAdded && item.my_last_read_at && new Date(message.created_at) > new Date(item.my_last_read_at) ? '<div class="unread-divider"><span>Unread messages</span></div>' : '';
      if (unreadDivider) unreadAdded = true;
      const attachment = message.attachment_path ? `<a class="message-attachment" href="${escAttr(signed.get(message.attachment_path) || '#')}" target="_blank" rel="noopener noreferrer" ${signed.get(message.attachment_path) ? '' : 'aria-disabled="true"'}>${message.attachment_type?.startsWith('image/') && signed.get(message.attachment_path) ? `<img src="${escAttr(signed.get(message.attachment_path))}" alt="${escAttr(message.attachment_name)}">` : icon('file', '', 18)}<span>${esc(message.attachment_name || 'Attachment')}<small>${(Number(message.attachment_size || 0) / 1024 / 1024).toFixed(2)} MB</small></span></a>` : '';
      return `${divider}${unreadDivider}<article class="chat-bubble ${mine ? 'mine' : ''}" data-message-id="${message.id}"><p>${esc(message.body).replace(/\n/g, '<br>')}</p>${attachment}<footer><time>${fmtDate(message.created_at,{hour:'numeric',minute:'2-digit'})}</time>${mine ? `<span class="message-receipt" title="${message.read_at ? 'Read' : 'Sent'}">${message.read_at ? '✓✓ Read' : '✓ Sent'}</span>` : ''}</footer></article>`;
    }).join('') || `<div class="messenger-empty welcome"><h3>Start the conversation</h3><p>Send a message to ${esc(item.other_name || 'this person')}.</p></div>`;
  }
  async function selectConversation(id, { updateHash = true } = {}) {
    activeId = id; oldest = null;
    if (updateHash) history.replaceState(null, '', `#messages?conversation=${encodeURIComponent(id)}`);
    await render();
  }
  async function render() {
    await removeActiveChannel();
    const item = inbox.find((row) => row.conversation_id === activeId) || null;
    root.innerHTML = `<section class="messenger ${item ? 'has-active' : ''}">${sidebarHTML()}<div class="messenger-chat" id="activeChat">${item ? `<header class="messenger-head chat-head">${avatar(item.other_name,item.other_avatar)}<div class="chat-contact"><h3>${esc(item.other_name || 'Former user')}</h3><p>${esc(item.other_role || 'User')}${item.course_title ? ` · ${esc(item.course_title)}` : ''}</p></div><span class="message-presence" id="peerPresence">${item.other_email ? `<a href="mailto:${escAttr(item.other_email)}">${esc(item.other_email)}</a>` : 'Account unavailable'}</span><button type="button" class="icon-btn mobile-back" data-back-inbox aria-label="Show conversations">${icon('arrow-left','',18)}</button><div class="conversation-actions"><button type="button" class="icon-btn" data-conversation-menu aria-label="Conversation options" aria-expanded="false">⋯</button><div class="conversation-menu" hidden><button type="button" data-conversation-action="unread">Mark as unread</button><button type="button" data-conversation-action="pin">${item.pinned ? 'Unpin conversation' : 'Pin conversation'}</button><button type="button" data-conversation-action="mute">${item.muted ? 'Unmute conversation' : 'Mute notifications'}</button><button type="button" data-conversation-action="archive">${item.archived ? 'Restore from archive' : 'Archive conversation'}</button></div></div></header><div class="messenger-stream" id="messageStream"><div class="message-load-older"><button class="btn btn-ghost btn-sm" type="button" data-load-older>Load older messages</button></div><div id="messageItems"><div class="card skeleton" style="min-height:180px"></div></div><div id="typingStatus" class="typing-status" aria-live="polite" hidden>Typing…</div></div><form id="messageForm" class="messenger-compose"><div id="emojiPicker" class="emoji-picker" hidden>${['🙂','😊','😂','👏','❤️','👍','🎉','🙏','💡','✅'].map((emoji) => `<button type="button" data-emoji="${emoji}" aria-label="Insert ${emoji}">${emoji}</button>`).join('')}</div><textarea class="input" id="messageBody" maxlength="5000" placeholder="Write a message… Enter to send, Shift + Enter for a new line" aria-label="Write a message" rows="2"></textarea><div class="compose-actions"><div><button type="button" class="icon-btn" data-toggle-emoji aria-label="Choose emoji">☺</button><label class="icon-btn attach-button" aria-label="Attach a file">${icon('file','',18)}<input id="messageFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,.doc,.docx,.ppt,.pptx,.xls,.xlsx" hidden></label><span id="attachmentName" class="selected-file"></span></div><button type="submit" class="btn btn-lime" id="sendMessage">Send ${icon('arrow-right','',16)}</button></div><p class="composer-note">Attachments up to 20 MB · Messages are visible only to conversation participants.</p></form>` : '<div class="messenger-empty welcome"><div class="empty-icon">' + icon('chat','',28) + '</div><h3>Your messages</h3><p>Choose a conversation or start a new one with an approved course contact.</p><button type="button" class="btn btn-lime" data-new-chat>Start a conversation</button></div>'}</div></section>`;
    bindInbox();
    if (!item) return;
    const messages = await loadMessages(activeId);
    if (!messages || activeId !== item.conversation_id) return;
    const messageItems = root.querySelector('#messageItems');
    if (messageItems) messageItems.innerHTML = await messageHTML(messages, item);
    const stream = root.querySelector('#messageStream'); if (stream) stream.scrollTop = stream.scrollHeight;
    oldest = messages[0]?.created_at || null;
    await supabase.rpc('mark_conversation_read', { p_conversation: activeId });
    await reloadInbox();
    const conversationId = activeId;
    activeChannel = supabase.channel(`messenger:${conversationId}`, { config: { private: true, presence: { key: me.id } } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => { const node = root.querySelector('#typingStatus'); if (node) node.hidden = payload?.user_id === me.id || !payload?.typing; })
      .on('presence', { event: 'sync' }, () => { const online = Object.keys(activeChannel.presenceState()).some((key) => key !== me.id); const node = root.querySelector('#peerPresence'); if (node && online) node.dataset.online = 'true'; })
      .subscribe(async (status) => { if (status === 'SUBSCRIBED') await activeChannel.track({ user_id: me.id, online_at: new Date().toISOString() }); });
  }
  function bindInbox() {
    root.querySelectorAll('[data-open-conversation]').forEach((button) => button.addEventListener('click', () => selectConversation(button.dataset.openConversation)));
    root.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => { filter = button.dataset.filter; render(); }));
    root.querySelectorAll('[data-new-chat]').forEach((button) => button.addEventListener('click', openNewChat));
    root.querySelector('[data-back-inbox]')?.addEventListener('click', () => { activeId = null; render(); });
    root.querySelector('[data-conversation-menu]')?.addEventListener('click', (event) => { const menu = root.querySelector('.conversation-menu'); if (menu) menu.hidden = !menu.hidden; event.currentTarget.setAttribute('aria-expanded', String(!menu.hidden)); });
    root.querySelectorAll('[data-conversation-action]').forEach((button) => button.addEventListener('click', async () => {
      const participant = inbox.find((row) => row.conversation_id === activeId); if (!participant) return;
      const action = button.dataset.conversationAction;
      if (action === 'unread') { const { error } = await supabase.from('conversation_participants').update({ last_read_at: null }).eq('conversation_id',activeId).eq('user_id',me.id); if (error) toast(error.message,'err'); activeId = null; }
      else {
        const update = action === 'pin' ? { pinned: !participant.pinned } : action === 'mute' ? { muted: !participant.muted } : { archived: !participant.archived };
        const { error } = await supabase.from('conversation_participants').update(update).eq('conversation_id',activeId).eq('user_id',me.id);
        if (error) return toast(error.message,'err');
        if (action === 'archive') { filter = participant.archived ? 'all' : 'archived'; activeId = null; }
      }
      await reloadInbox(); render();
    }));
    root.querySelector('#messageSearch')?.addEventListener('input', (event) => {
      search = event.target.value.toLowerCase().trim(); messageMatches = null;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        if (search.length >= 2 && inbox.length) {
          const { data } = await supabase.from('conversation_messages').select('conversation_id').in('conversation_id', inbox.map((item) => item.conversation_id)).ilike('body', `%${search}%`).limit(200);
          messageMatches = new Set((data || []).map((row) => row.conversation_id));
        }
        const list = root.querySelector('#conversationList'); if (list) { list.innerHTML = threadRowsHTML(); list.querySelectorAll('[data-open-conversation]').forEach((button) => button.addEventListener('click', () => selectConversation(button.dataset.openConversation))); }
      }, 220);
    });
    root.querySelector('[data-load-older]')?.addEventListener('click', async () => {
      if (!oldest || loadingMore || !activeId) return;
      loadingMore = true; const button = root.querySelector('[data-load-older]'); if (button) button.textContent = 'Loading…';
      const items = await loadMessages(activeId, oldest); if (items?.length) { const box = root.querySelector('#messageItems'); const oldHeight = root.querySelector('#messageStream')?.scrollHeight || 0; box?.insertAdjacentHTML('afterbegin', await messageHTML(items, inbox.find((row) => row.conversation_id === activeId))); const stream = root.querySelector('#messageStream'); if (stream) stream.scrollTop = stream.scrollHeight - oldHeight; }
      loadingMore = false; if (button) button.textContent = 'Load older messages';
    });
    root.querySelector('[data-toggle-emoji]')?.addEventListener('click', () => { const picker = root.querySelector('#emojiPicker'); if (picker) picker.hidden = !picker.hidden; });
    root.querySelectorAll('[data-emoji]').forEach((button) => button.addEventListener('click', () => { const field = root.querySelector('#messageBody'); if (!field) return; const start = field.selectionStart, end = field.selectionEnd; field.setRangeText(button.dataset.emoji, start, end, 'end'); field.focus(); }));
    root.querySelector('#messageFile')?.addEventListener('change', (event) => { const file = event.target.files[0]; const label = root.querySelector('#attachmentName'); if (label) label.textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : ''; });
    const form = root.querySelector('#messageForm');
    form?.querySelector('#messageBody').addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); } });
    form?.querySelector('#messageBody').addEventListener('input', () => {
      activeChannel?.send({ type: 'broadcast', event: 'typing', payload: { user_id: me.id, typing: true } }); clearTimeout(typingTimer);
      typingTimer = setTimeout(() => activeChannel?.send({ type: 'broadcast', event: 'typing', payload: { user_id: me.id, typing: false } }), 1400);
    });
    form?.addEventListener('submit', sendMessage);
  }
  function connectInboxLive() {
    if (liveChannel) supabase.removeChannel(liveChannel);
    liveChannel = supabase.channel(`messaging-inbox:${me.id}`, { config: { private: true } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_messages' }, async ({ new: message }) => {
        await reloadInbox();
        if (message.conversation_id === activeId) { if (message.sender_id !== me.id) await supabase.rpc('mark_conversation_read', { p_conversation: activeId }); await render(); }
        else refreshConversationList();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_messages' }, async ({ new: message }) => { if (message.conversation_id === activeId) await render(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${me.id}` }, async () => { await reloadInbox(); if (root.isConnected) refreshConversationList(); })
      .subscribe();
  }
  async function sendMessage(event) {
    event.preventDefault(); const body = root.querySelector('#messageBody').value.trim(); const fileInput = root.querySelector('#messageFile'); const file = fileInput?.files[0];
    if (!body && !file) return;
    const button = root.querySelector('#sendMessage'); const bodyInput = root.querySelector('#messageBody'); const original = button.innerHTML;
    button.disabled = true; button.textContent = 'Sending…';
    let attachment_path = null;
    if (file) {
      if (file.size > 20 * 1024 * 1024) { button.disabled = false; button.innerHTML = original; return toast('Choose a file smaller than 20 MB.', 'err'); }
      const type = file.type || 'application/octet-stream';
      const allowed = /^(image\/(jpeg|png|webp|gif)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|presentationml\.presentation|spreadsheetml\.sheet)|vnd\.ms-powerpoint|vnd\.ms-excel)|text\/plain)$/i.test(type);
      if (!allowed) { button.disabled = false; button.innerHTML = original; return toast('This file type is not supported.', 'err'); }
      attachment_path = `${activeId}/${me.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
      const { error } = await supabase.storage.from('message-attachments').upload(attachment_path, file, { upsert: false, contentType: type });
      if (error) { button.disabled = false; button.innerHTML = original; return toast(`Attachment upload failed: ${error.message}`, 'err'); }
    }
    const nonce = retryNonce || (retryNonce = crypto.randomUUID());
    let { error } = await supabase.from('conversation_messages').insert({ conversation_id: activeId, sender_id: me.id, client_nonce: nonce, body, attachment_path, attachment_name: file?.name || null, attachment_type: file?.type || null, attachment_size: file?.size || null });
    if (error) {
      const { data: existing } = await supabase.from('conversation_messages').select('id').eq('conversation_id',activeId).eq('sender_id',me.id).eq('client_nonce',nonce).maybeSingle();
      if (existing) error = null;
      else if (attachment_path) await supabase.storage.from('message-attachments').remove([attachment_path]);
    }
    button.disabled = false; button.innerHTML = original;
    if (error) return toast(`Message was not sent: ${error.message}. Your text is still in the composer so you can retry.`, 'err');
    retryNonce = null;
    bodyInput.value = ''; fileInput.value = ''; const label = root.querySelector('#attachmentName'); if (label) label.textContent = '';
    activeChannel?.send({ type: 'broadcast', event: 'typing', payload: { user_id: me.id, typing: false } });
    await reloadInbox(); await render();
  }
  async function openNewChat() {
    const { data, error } = await supabase.rpc('messaging_contacts');
    if (error) return toast(`Could not load approved contacts: ${error.message}`, 'err');
    contacts = data || [];
    if (!contacts.length) return toast('There are no approved messaging contacts yet.', 'info');
    const overlay = document.createElement('div'); overlay.className = 'modal-backdrop';
    overlay.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="newConversationTitle"><header class="modal-head"><h2 id="newConversationTitle">New conversation</h2><button type="button" class="icon-btn" data-close-modal aria-label="Close">×</button></header><div class="modal-body"><label for="messageContact">Choose a course contact</label><select id="messageContact" class="input">${contacts.map((contact,index) => `<option value="${index}">${esc(contact.full_name || contact.email)} · ${esc(contact.role)}${contact.course_title ? ` · ${esc(contact.course_title)}` : ''}</option>`).join('')}</select><p class="muted">Students can message assigned tutors and administrators. Tutors can message enrolled students and staff.</p></div><footer class="modal-actions"><button type="button" class="btn btn-outline" data-close-modal>Cancel</button><button type="button" class="btn btn-lime" data-start-conversation>Open conversation</button></footer></section>`;
    document.body.append(overlay);
    overlay.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => overlay.remove()));
    overlay.addEventListener('click', (event) => { if (event.target === overlay) overlay.remove(); });
    overlay.querySelector('[data-start-conversation]').addEventListener('click', async () => {
      const contact = contacts[Number(overlay.querySelector('#messageContact').value)]; if (!contact) return;
      const { data: id, error: openError } = await supabase.rpc('open_direct_conversation', { p_recipient: contact.user_id, p_course: contact.course_id || null });
      if (openError) return toast(openError.message, 'err');
      overlay.remove(); await reloadInbox(); await selectConversation(id);
    });
  }
  root.innerHTML = '<section class="messenger"><div class="messenger-inbox"><header class="messenger-head"><h2>Messages</h2></header><div class="messenger-threads"><div class="card skeleton" style="min-height:260px"></div></div></div><div class="messenger-chat"></div></section>';
  if (!await reloadInbox()) {
    root.innerHTML = `<div class="panel"><h2>Inbox temporarily unavailable</h2><p class="muted">The inbox could not connect. Check your connection and try again.</p><button type="button" class="btn btn-lime" data-retry-inbox>Try again</button></div>`;
    root.querySelector('[data-retry-inbox]')?.addEventListener('click', async (event) => {
      event.currentTarget.disabled = true; event.currentTarget.textContent = 'Connecting…';
      if (await reloadInbox()) { if (!activeId && inbox.length) activeId = inbox[0].conversation_id; await render(); connectInboxLive(); }
      else { event.currentTarget.disabled = false; event.currentTarget.textContent = 'Try again'; }
    });
    return removeChannels;
  }
  if (!activeId && inbox.length) activeId = inbox[0].conversation_id;
  await render();
  connectInboxLive();
  return async () => { clearTimeout(searchTimer); clearTimeout(typingTimer); await removeChannels(); };
}

export async function mountNotificationBell({ supabase, me }) {
  const host = document.getElementById('notificationBell'); if (!host) return () => {};
  let channel;
  const refresh = async () => {
    const [{ count }, { data }] = await Promise.all([
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', me.id).eq('read', false),
      supabase.from('notifications').select('id,title,body,link,read,created_at').eq('user_id', me.id).order('created_at', { ascending: false }).limit(6),
    ]);
    const noticePage = me.role === 'student' ? 'dashboard.html#notifications' : 'admin.html#my-notifications';
    host.innerHTML = `<button class="icon-btn notification-bell-button" type="button" aria-label="Notifications" aria-expanded="false" data-bell-toggle>${icon('bell','',19)}${count ? `<span class="bell-count">${count > 99 ? '99+' : count}</span>` : ''}</button><div class="notification-popover" hidden><header><strong>Notifications</strong><a href="${noticePage}">View all</a></header>${(data || []).map((notice) => `<a class="bell-notice ${notice.read ? '' : 'unread'}" href="${safeHref(notice.link || noticePage)}" data-notification-id="${notice.id}"><span>${esc(notice.title)}</span><small>${esc(notice.body || '')}</small><time>${fmtDate(notice.created_at,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</time></a>`).join('') || '<p class="messenger-empty">You’re all caught up.</p>'}<footer><button type="button" data-mark-notifications>Mark all as read</button></footer></div>`;
    host.querySelector('[data-bell-toggle]')?.addEventListener('click', (event) => { const popover = host.querySelector('.notification-popover'); popover.hidden = !popover.hidden; event.currentTarget.setAttribute('aria-expanded', String(!popover.hidden)); });
    host.querySelector('[data-mark-notifications]')?.addEventListener('click', async () => { await supabase.from('notifications').update({ read: true }).eq('user_id', me.id).eq('read', false); refresh(); });
    host.querySelectorAll('[data-notification-id]').forEach((link) => link.addEventListener('click', async (event) => { event.preventDefault(); await supabase.from('notifications').update({ read: true }).eq('id', link.dataset.notificationId).eq('user_id', me.id); location.assign(link.href); }));
  };
  await refresh();
  channel = supabase.channel(`notification-bell:${me.id}`, { config: { private: true } }).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${me.id}` }, refresh).subscribe();
  return () => channel && supabase.removeChannel(channel);
}
