// --- SUPABASE CONNECTION ---

const SUPABASE_URL = 'https://iktfixreihircmwseooy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_n0Iea3PHxYO6RGpHqPQhpA_wAsX4QMR';

const dbClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
); 


// --- ЗАГРУЗКА ЛЕНТЫ ПУБЛИКАЦИЙ ---

const postsFeed = document.getElementById('posts-feed');

// Защита текста от вставки HTML и скриптов
function escapePostHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}


 // --- СОЗДАНИЕ КАРТОЧКИ ПУБЛИКАЦИИ ---



function createPostCard(post) {
  const profile = post.profiles || {};
  const profileId = escapePostHTML(post.user_id);

  const username = escapePostHTML(
    profile.display_name || profile.username || 'Пользователь'
  );

  const content = escapePostHTML(post.content);

  const date = new Date(post.created_at).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const avatar = profile.avatar_url
    ? `<img class="post-avatar-img" src="${escapePostHTML(profile.avatar_url)}" alt="Аватар" loading="lazy">`
    : '<span class="avatar-label">ава</span>';

  const photos = (post.photoUrls || []).map(url => `
    <img
      class="post-photo"
      src="${escapePostHTML(url)}"
      alt="Фотография публикации"
      loading="lazy"
    >
  `).join('');

  const privacyButton = post.isOwn ? `
    <button
      type="button"
      class="post-privacy-btn"
      data-post-id="${escapePostHTML(post.id)}"
    >
      В архив
    </button>
  ` : '';

  const deleteButton = post.isOwn ? `
    <button
      type="button"
      class="y2k-btn delete-post-btn"
      data-post-id="${escapePostHTML(post.id)}"
    >
      Удалить
    </button>
  ` : '';

  return `
    <article class="post-card flip-phone-card">
      <div class="phone-wrapper">
        <div class="phone-screen">
          <p class="post-text">${content}</p>
          ${photos ? `<div class="post-photos-gallery">${photos}</div>` : ''}
        </div>
      </div>

      <div class="phone-info">
        <div class="user-avatar-box post-profile-link" data-profile-id="${profileId}">
          ${avatar}
        </div>

        <div class="user-details">
          <div class="user-name post-profile-link" data-profile-id="${profileId}">
            ${username}
          </div>
          <div class="post-date">${escapePostHTML(date)}</div>
        </div>
      </div>

            <div class="post-comments" data-post-id="${escapePostHTML(post.id)}">
        <h4>Комментарии</h4>

        <div class="comments-list">
          <p>Загружаем комментарии...</p>
        </div>

        <form class="comment-form" data-post-id="${escapePostHTML(post.id)}">
          <textarea
            class="comment-input"
            placeholder="напиши комментарий..."
            maxlength="1000"
            required
          ></textarea>

          <button type="submit" class="y2k-btn">
            Отправить
          </button>
        </form>
      </div>

      ${privacyButton}
      ${deleteButton}
    </article>
  `;
}




// --- ЗАГРУЗКА ПУБЛИЧНОЙ ЛЕНТЫ ---

async function loadFeed() {
  if (!postsFeed) return;

  postsFeed.innerHTML = '<p class="feed-loading">Загружаем публикации...</p>';

  const { data: userData } = await dbClient.auth.getUser();
  const currentUserId = userData?.user?.id;

  const { data: posts, error } = await dbClient
    .from('posts')
    .select(`
      id,
      user_id,
      content,
      is_private,
      created_at,
      profiles (
        username,
        display_name,
        avatar_url
      ),
      post_photos (
        storage_path
      )
    `)
    .eq('status', 'approved')
    .eq('is_private', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Ошибка загрузки ленты:', error);
    postsFeed.innerHTML =
      '<p class="feed-loading">Не удалось загрузить публикации.</p>';
    return;
  }

  if (!posts || posts.length === 0) {
    postsFeed.innerHTML =
      '<p class="feed-loading">Пока здесь нет публикаций. Будь первой!</p>';
    return;
  }

  // Получаем временные ссылки на фотографии

  const postsWithPhotos = await Promise.all(
    posts.map(async post => {
      const photoUrls = [];

      for (const photo of post.post_photos || []) {
        const { data, error: photoError } = await dbClient.storage
          .from('post-photos')
          .createSignedUrl(photo.storage_path, 3600);

        if (photoError) {
          console.error('Ошибка получения фотографии:', photoError);
          continue;
        }

        if (data?.signedUrl) {
          photoUrls.push(data.signedUrl);
        }
      }

      return {
        ...post,
        photoUrls,
        isOwn: post.user_id === currentUserId
      };
    })
  );

  postsFeed.innerHTML = postsWithPhotos.map(createPostCard).join('');

  postsFeed.querySelectorAll('.post-comments').forEach(container => {
  loadPostComments(container.dataset.postId, container);
});


postsFeed.querySelectorAll('.delete-post-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    await deletePost(btn.dataset.postId);
  });
});


  // Кнопки отправки публикаций в архив

  const privacyButtons = postsFeed.querySelectorAll('.post-privacy-btn');

  privacyButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const postId = button.dataset.postId;

      button.disabled = true;
      button.textContent = 'Перемещаем...';

      const { error: privacyError } = await dbClient.rpc(
        'set_post_privacy',
        {
          p_post_id: postId,
          p_is_private: true
        }
      );

      if (privacyError) {
        console.error('Ошибка изменения приватности:', privacyError);

        button.disabled = false;
        button.textContent = 'В архив';

        alert('Не удалось переместить публикацию в архив.');
        return;
      }

      await loadFeed();
    });
  });
}

// --- ЗАГРУЗКА КОММЕНТАРИЕВ ---

async function loadPostComments(postId, container) {
  const commentsList = container.querySelector('.comments-list');

  if (!commentsList) return;

  const { data: comments, error } = await dbClient
    .from('comments')
    .select(`
      id,
      post_id,
      user_id,
      parent_id,
      content,
      created_at,
      profiles (
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Ошибка загрузки комментариев:', error);
    commentsList.innerHTML = '<p>Не удалось загрузить комментарии.</p>';
    return;
  }

  container.querySelector('h4').textContent =
    `Комментарии (${comments.length})`;

  if (comments.length === 0) {
    commentsList.innerHTML = '<p>Пока нет комментариев.</p>';
    return;
  }

  const currentUserResult = await dbClient.auth.getUser();
  const currentUserId = currentUserResult.data?.user?.id;

  const { data: currentProfile } = await dbClient
  .from('profiles')
  .select('is_admin')
  .eq('id', currentUserId)
  .maybeSingle();

const canDeleteComments =
  currentProfile?.is_admin === true;

  const topLevelComments = comments.filter(comment => !comment.parent_id);

  commentsList.innerHTML = topLevelComments.map(comment => {
    const profile = comment.profiles || {};
    const name = escapePostHTML(
      profile.display_name || profile.username || 'Пользователь'
    );

    const avatar = profile.avatar_url
      ? `<img src="${escapePostHTML(profile.avatar_url)}" alt="Аватар">`
      : '<span>ава</span>';

    const date = new Date(comment.created_at).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    const text = escapePostHTML(comment.content);

 const deleteButton =
  comment.user_id === currentUserId || canDeleteComments
    ? `<button type="button" class="delete-comment-btn" data-comment-id="${escapePostHTML(comment.id)}">Удалить</button>`
    : '';

    return `
      <div class="comment-card" data-comment-id="${escapePostHTML(comment.id)}">
        <div class="comment-header">
          <div class="comment-avatar">${avatar}</div>
          <div class="comment-user-info">
            <strong>${name}</strong>
            <span>${escapePostHTML(date)}</span>
          </div>
        </div>

        <p class="comment-text">${text}</p>

        <div class="comment-actions">
          <button
            type="button"
            class="reply-comment-btn"
            data-comment-id="${escapePostHTML(comment.id)}"
          >
            Ответить
          </button>
          ${deleteButton}
        </div>

        <div class="comment-replies"></div>
      </div>
    `;
  }).join('');

  // Добавляем ответы к комментариям

  comments.filter(comment => comment.parent_id).forEach(comment => {
    const parent = commentsList.querySelector(
      `[data-comment-id="${comment.parent_id}"] .comment-replies`
    );

    if (!parent) return;

    const profile = comment.profiles || {};
    const name = escapePostHTML(
      profile.display_name || profile.username || 'Пользователь'
    );

    const text = escapePostHTML(comment.content);

    const date = new Date(comment.created_at).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    const deleteButton = comment.user_id === currentUserId
      ? `<button type="button" class="delete-comment-btn" data-comment-id="${escapePostHTML(comment.id)}">Удалить</button>`
      : '';

    const avatar = profile.avatar_url
      ? `<img src="${escapePostHTML(profile.avatar_url)}" alt="Аватар">`
      : '<span>ава</span>';

    parent.insertAdjacentHTML('beforeend', `
      <div class="comment-card comment-reply" data-comment-id="${escapePostHTML(comment.id)}">
        <div class="comment-header">
          <div class="comment-avatar">${avatar}</div>
          <div class="comment-user-info">
            <strong>${name}</strong>
            <span>${escapePostHTML(date)}</span>
          </div>
        </div>

        <p class="comment-text">${text}</p>

        <div class="comment-actions">
          ${deleteButton}
        </div>
      </div>
    `);
  });
}

// --- ОТПРАВКА КОММЕНТАРИЕВ ---

postsFeed.addEventListener('submit', async event => {
  const form = event.target.closest('.comment-form');

  if (!form) return;

  event.preventDefault();

  const postId = form.dataset.postId;
  const input = form.querySelector('.comment-input');
  const content = input.value.trim();
  const button = form.querySelector('button[type="submit"]');

  if (!content) return;

  const { data: userData } = await dbClient.auth.getUser();
  const userId = userData?.user?.id;

  if (!userId) {
    alert('Необходимо войти в аккаунт.');
    return;
  }

  button.disabled = true;
  button.textContent = 'Отправляем...';

  const { error } = await dbClient
    .from('comments')
    .insert({
      post_id: postId,
      user_id: userId,
      content: content
    });

  if (error) {
    console.error('Ошибка отправки комментария:', error);
    alert('Не удалось отправить комментарий.');
    button.disabled = false;
    button.textContent = 'Отправить';
    return;
  }

  input.value = '';
  button.disabled = false;
  button.textContent = 'Отправить';

  const container = form.closest('.post-comments');
  await loadPostComments(postId, container);
});


// --- УДАЛЕНИЕ КОММЕНТАРИЕВ ---

postsFeed.addEventListener('click', async event => {
  const button = event.target.closest('.delete-comment-btn');

  if (!button) return;

  const commentId = button.dataset.commentId;
  const container = button.closest('.post-comments');

  if (!confirm('Удалить этот комментарий?')) return;

  button.disabled = true;

  const { error } = await dbClient
    .from('comments')
    .delete()
    .eq('id', commentId);

  if (error) {
    console.error('Ошибка удаления комментария:', error);
    alert('Не удалось удалить комментарий.');
    button.disabled = false;
    return;
  }

  await loadPostComments(container.dataset.postId, container);
});

// --- ОТВЕТЫ НА КОММЕНТАРИИ ---

postsFeed.addEventListener('click', event => {
  const button = event.target.closest('.reply-comment-btn');

  if (!button) return;

  const commentCard = button.closest('.comment-card');
  const postComments = button.closest('.post-comments');

  if (!commentCard || !postComments) return;

  const existingForm = commentCard.querySelector('.reply-form');

  if (existingForm) {
    existingForm.remove();
    return;
  }

  const form = document.createElement('form');
  form.className = 'reply-form';

  form.innerHTML = `
    <textarea
      class="comment-input"
      placeholder="напиши ответ..."
      maxlength="1000"
      required
    ></textarea>

    <button type="submit" class="y2k-btn">
      Ответить
    </button>
  `;

  commentCard.appendChild(form);
  form.querySelector('textarea').focus();
});

// --- ОТПРАВКА ОТВЕТОВ ---

postsFeed.addEventListener('submit', async event => {
  const form = event.target.closest('.reply-form');

  if (!form) return;

  event.preventDefault();

  const commentCard = form.closest('.comment-card');
  const postComments = form.closest('.post-comments');

  const parentId = commentCard.dataset.commentId;
  const postId = postComments.dataset.postId;
  const input = form.querySelector('textarea');
  const content = input.value.trim();
  const button = form.querySelector('button');

  if (!content) return;

  const { data: userData } = await dbClient.auth.getUser();
  const userId = userData?.user?.id;

  if (!userId) {
    alert('Необходимо войти в аккаунт.');
    return;
  }

  button.disabled = true;
  button.textContent = 'Отправляем...';

  const { error } = await dbClient
    .from('comments')
    .insert({
      post_id: postId,
      user_id: userId,
      parent_id: parentId,
      content: content
    });

  if (error) {
    console.error('Ошибка отправки ответа:', error);
    alert('Не удалось отправить ответ.');
    button.disabled = false;
    button.textContent = 'Ответить';
    return;
  }

  await loadPostComments(postId, postComments);
});

// --- ПЕРЕХОД В ПРОФИЛЬ АВТОРА ПУБЛИКАЦИИ ---

postsFeed.addEventListener('click', event => {
  const profileLink = event.target.closest('.post-profile-link');

  if (!profileLink) return;

  const userId = profileLink.dataset.profileId;

  if (!userId) return;

  openPublicProfile(userId);
});


// --- ЗАГРУЗКА АРХИВА ПРОФИЛЯ ---


async function loadArchive() {
  const archiveContainer = document.getElementById('archive-posts');

  if (!archiveContainer) return;

  const { data: userData } = await dbClient.auth.getUser();

  if (!userData.user) return;

  archiveContainer.innerHTML = '<p>Загружаем архив...</p>';

  const { data: posts, error } = await dbClient
    .from('posts')
    .select(`
      id,
      content,
      created_at,
      post_photos(storage_path)
    `)
    .eq('user_id', userData.user.id)
    .eq('status', 'approved')
    .eq('is_private', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Ошибка загрузки архива:', error);
    archiveContainer.innerHTML = '<p>Не удалось загрузить архив.</p>';
    return;
  }

  if (!posts || posts.length === 0) {
    archiveContainer.innerHTML = '<p>Твой архив пока пуст.</p>';
    return;
  }

  const cards = await Promise.all(posts.map(async post => {
    const photos = await Promise.all(
      (post.post_photos || []).map(async photo => {
        const { data, error } = await dbClient.storage
          .from('post-photos')
          .createSignedUrl(photo.storage_path, 3600);

        if (error || !data) return '';

        return `
          <img
            class="post-photo"
            src="${data.signedUrl}"
            alt="Фотография из архива"
          >
        `;
      })
    );

    return `
      <article class="post-card archive-post-card">

        <p class="archive-post-date">
          ${new Date(post.created_at).toLocaleString('ru-RU')}
        </p>

        <div class="archive-post-content">
          ${escapePostHTML(post.content || '')}
        </div>

        <div class="post-photos-gallery">
          ${photos.join('')}
        </div>

        <button
          type="button"
          class="y2k-btn pink-btn restore-post-btn"
          data-post-id="${escapePostHTML(post.id)}"
        >
          Вернуть в ленту
        </button>

        <button
          type="button"
          class="y2k-btn delete-post-btn"
          data-post-id="${escapePostHTML(post.id)}"
        >
          Удалить
        </button>

      </article>
    `;
  }));

  archiveContainer.innerHTML = cards.join('');

  archiveContainer.querySelectorAll('.restore-post-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const postId = btn.dataset.postId;

      if (!confirm('Вернуть публикацию в публичную ленту?')) return;

      btn.disabled = true;

      const { error } = await dbClient.rpc('set_post_privacy', {
        p_post_id: postId,
        p_is_private: false
      });

      if (error) {
        console.error('Ошибка восстановления публикации:', error);
        alert('Не удалось вернуть публикацию.');
        btn.disabled = false;
        return;
      }

      await loadArchive();
      await loadFeed();
    });
  });

  archiveContainer.querySelectorAll('.delete-post-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await deletePost(btn.dataset.postId);
    });
  });
}



// --- УДАЛЕНИЕ ПУБЛИКАЦИИ ---

async function deletePost(postId) {
  const confirmed = confirm(
    'Ты точно хочешь удалить эту публикацию? Это действие нельзя отменить.'
  );

  if (!confirmed) return;

  const { data: userData } = await dbClient.auth.getUser();

  if (!userData.user) {
    alert('Необходимо войти в аккаунт.');
    return;
  }

  // Получаем фотографии публикации
  const { data: photos, error: photosError } = await dbClient
    .from('post_photos')
    .select('storage_path')
    .eq('post_id', postId);

  if (photosError) {
    console.error(photosError);
    alert('Не удалось получить фотографии публикации.');
    return;
  }

  // Удаляем фотографии из приватного хранилища
  const paths = (photos || []).map(photo => photo.storage_path);

  if (paths.length > 0) {
    const { error: storageError } = await dbClient
      .storage
      .from('post-photos')
      .remove(paths);

    if (storageError) {
      console.error(storageError);
      alert('Не удалось удалить фотографии. Публикация пока не удалена.');
      return;
    }
  }

  // Удаляем саму публикацию
  const { error } = await dbClient
    .from('posts')
    .delete()
    .eq('id', postId)
    .eq('user_id', userData.user.id);

  if (error) {
    console.error(error);
    alert('Не удалось удалить публикацию.');
    return;
  }

  alert('Публикация удалена.');

  await loadFeed();
  await loadArchive();
}


// --- АДМИН-ПАНЕЛЬ: ЗАГРУЗКА ПУБЛИКАЦИЙ ---

async function loadAdminPosts() {
  const adminList = document.getElementById('admin-posts-list');

  if (!adminList) return;

  const { data: userData } = await dbClient.auth.getUser();

  if (!userData.user) return;

  const { data: profile } = await dbClient
    .from('profiles')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single();
console.log('Ответ Supabase:', { profile, error });
  if (!profile || profile.is_admin !== true) {
    adminList.innerHTML = '<p>Доступ запрещён.</p>';
    return;
  }

  adminList.innerHTML = '<p>Загружаем публикации...</p>';

  const { data: posts, error } = await dbClient
    .from('posts')
    .select(`
      id,
      user_id,
      content,
      created_at,
      profiles(username, display_name),
      post_photos(storage_path)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Ошибка загрузки модерации:', error);
    adminList.innerHTML = '<p>Не удалось загрузить публикации.</p>';
    return;
  }

  if (!posts || posts.length === 0) {
    adminList.innerHTML = '<p>Пока нет публикаций на модерацию.</p>';
    return;
  }

  const cards = await Promise.all(posts.map(async post => {
    const photos = await Promise.all(
      (post.post_photos || []).map(async photo => {
        const { data, error } = await dbClient.storage
          .from('post-photos')
          .createSignedUrl(photo.storage_path, 3600);

        if (error || !data) return '';

        return `<img class="admin-post-photo"
          src="${data.signedUrl}"
          alt="Фотография публикации">`;
      })
    );

    const author = post.profiles?.display_name ||
      post.profiles?.username ||
      'Неизвестный автор';

    const username = post.profiles?.username || '';

    return `
      <article class="admin-post-card" data-post-id="${post.id}">
        <div class="admin-post-author">
          <strong>${escapePostHTML(author)}</strong>
          <span>@${escapePostHTML(username)}</span>
        </div>

        <p class="admin-post-date">
          ${new Date(post.created_at).toLocaleString('ru-RU')}
        </p>

        <div class="admin-post-content">
          ${escapePostHTML(post.content || '')}
        </div>

        <div class="admin-post-gallery">
          ${photos.join('')}
        </div>

        <div class="admin-post-actions">
          <button class="y2k-btn pink-btn admin-approve-btn"
            data-id="${post.id}">
            Одобрить
          </button>

          <button class="y2k-btn admin-reject-btn"
            data-id="${post.id}">
            Отклонить
          </button>
        </div>
      </article>
    `;
  }));

  adminList.innerHTML = cards.join('');

  adminList.querySelectorAll('.admin-approve-btn').forEach(btn => {
    btn.addEventListener('click', () => moderatePost(btn.dataset.id, 'approved'));
  });

  adminList.querySelectorAll('.admin-reject-btn').forEach(btn => {
    btn.addEventListener('click', () => moderatePost(btn.dataset.id, 'rejected'));
  });
}


// --- ОДОБРЕНИЕ И ОТКЛОНЕНИЕ ---

async function moderatePost(postId, newStatus) {
  const action = newStatus === 'approved' ? 'одобрить' : 'отклонить';

  if (!confirm(`Точно ${action} эту публикацию?`)) return;

  const { data: userData } = await dbClient.auth.getUser();

  if (!userData.user) return;

  const { data: profile } = await dbClient
    .from('profiles')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single();

  if (!profile || profile.is_admin !== true) {
    alert('Доступ запрещён.');
    return;
  }

  const { error } = await dbClient
    .from('posts')
    .update({ status: newStatus })
    .eq('id', postId)
    .eq('status', 'pending');

  if (error) {
    console.error('Ошибка модерации:', error);
    alert('Не удалось изменить статус публикации.');
    return;
  }

  await loadAdminPosts();
  await loadFeed();
}


// --- ЗВЁЗДНЫЙ ШЛЕЙФ КУРСОРА ---
const canvas = document.getElementById('cursor-canvas');
const ctx = canvas.getContext('2d');
let sparkles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Sparkle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * 6 + 3;
    this.speedX = (Math.random() - 0.5) * 1.5;
    this.speedY = Math.random() * 1 + 0.5;
    this.opacity = 1;

    const colors = ['#ff69b4', '#ffd700', '#ffffff', '#e6a8d7', '#ff1493'];
    this.color = colors[Math.floor(Math.random() * colors.length)];
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.opacity -= 0.03;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.opacity);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x - this.size, this.y);
    ctx.lineTo(this.x + this.size, this.y);
    ctx.moveTo(this.x, this.y - this.size);
    ctx.lineTo(this.x, this.y + this.size);
    ctx.stroke();
    ctx.restore();
  }
}

window.addEventListener('mousemove', (e) => {
  for (let i = 0; i < 2; i++) {
    sparkles.push(new Sparkle(e.clientX, e.clientY));
  }
});

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < sparkles.length; i++) {
    sparkles[i].update();
    sparkles[i].draw();

    if (sparkles[i].opacity <= 0) {
      sparkles.splice(i, 1);
      i--;
    }
  }

  requestAnimationFrame(animate);
}

animate();


// --- УПРАВЛЕНИЕ ДАННЫМИ ПРОФИЛЯ ---
const displayName = document.getElementById('display-name');
const displayStatus = document.getElementById('display-status');
const displaySong = document.getElementById('display-song');
const displayArtist = document.getElementById('display-artist');

const postUserName = document.getElementById('post-user-name');
const postUserStatus = document.getElementById('post-user-status');
const postInputName = document.getElementById('post-input-name');
const postInputStatus = document.getElementById('post-input-status');

const avatarInput = document.getElementById('avatar-input');
const avatarPreview = document.getElementById('avatar-preview');
const avatarPlaceholder = document.getElementById('avatar-placeholder');

const postAvatarPreview = document.getElementById('post-avatar-preview');
const postAvatarPlaceholder = document.getElementById('post-avatar-placeholder');

const profileModal = document.getElementById('profile-modal');
const editProfileBtn = document.getElementById('edit-profile-btn');
const closeBtn = document.getElementById('close-modal-btn');
const saveBtn = document.getElementById('save-profile-btn');

const inputName = document.getElementById('input-name');
const inputStatus = document.getElementById('input-status');
const inputSong = document.getElementById('input-song');
const inputArtist = document.getElementById('input-artist');


// Загрузка данных из localStorage
function loadProfileData() {
  const savedName = localStorage.getItem('y2k_name') || 'шмигулі2007';
  const savedStatus = localStorage.getItem('y2k_status') || 'статус: in love...';
  const savedSong = localStorage.getItem('y2k_song') || 'song name';
  const savedArtist = localStorage.getItem('y2k_artist') || 'author';
  const savedAvatar = localStorage.getItem('y2k_avatar');

  displayName.innerText = savedName;
  displayStatus.innerText = savedStatus.startsWith('статус:')
    ? savedStatus
    : `статус: ${savedStatus}`;

  displaySong.innerText = savedSong;
  displayArtist.innerText = savedArtist;

  if (postUserName) postUserName.innerText = savedName;
  if (postUserStatus) postUserStatus.innerText = displayStatus.innerText;
  if (postInputName) postInputName.value = savedName;
  if (postInputStatus) postInputStatus.value = displayStatus.innerText;

  if (savedAvatar) {
    avatarPreview.src = savedAvatar;
    avatarPreview.classList.remove('hidden');
    avatarPlaceholder.classList.add('hidden');

    if (postAvatarPreview) {
      postAvatarPreview.src = savedAvatar;
      postAvatarPreview.classList.remove('hidden');

      if (postAvatarPlaceholder) {
        postAvatarPlaceholder.classList.add('hidden');
      }
    }
  }
}


// Загрузка аватара

// Загрузка аватара в Supabase Storage
avatarInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];

  if (!file) return;

  // Проверяем формат и размер
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (!allowedTypes.includes(file.type)) {
    alert('Выбери изображение JPG, PNG или WEBP.');
    avatarInput.value = '';
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    alert('Размер изображения не должен превышать 2 МБ.');
    avatarInput.value = '';
    return;
  }

  const { data: userData, error: userError } =
    await dbClient.auth.getUser();

  if (userError || !userData.user) {
    alert('Не удалось определить пользователя.');
    return;
  }

  const userId = userData.user.id;
  const fileExtension = file.type.split('/')[1];
  const filePath = `${userId}/avatar.${fileExtension}`;

  // Получаем старый аватар
  const { data: profile, error: profileError } = await dbClient
    .from('profiles')
    .select('avatar_url')
    .eq('id', userId)
    .single();

  if (profileError) {
    console.error(profileError);
    alert('Не удалось загрузить данные профиля.');
    return;
  }

  // Удаляем старый файл, если он существует
  if (profile.avatar_url) {
    const oldPath = profile.avatar_url.split('/avatars/')[1];

    if (oldPath) {
      const { error: deleteError } = await dbClient.storage
        .from('avatars')
        .remove([oldPath]);

      if (deleteError) {
        console.error('Ошибка удаления старого аватара:', deleteError);
      }
    }
  }

  // Загружаем новую фотографию
  const { error: uploadError } = await dbClient.storage
    .from('avatars')
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type
    });

  if (uploadError) {
    console.error(uploadError);
    alert('Не удалось загрузить аватар.');
    return;
  }

  // Получаем публичную ссылку
  const { data: urlData } = dbClient.storage
    .from('avatars')
    .getPublicUrl(filePath);

  const avatarUrl = urlData.publicUrl;

  // Сохраняем ссылку в профиле
  const { error: updateError } = await dbClient
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);

  if (updateError) {
    console.error(updateError);
    alert('Фото загружено, но не удалось сохранить ссылку.');
    return;
  }

  // Обновляем аватар на странице
  avatarPreview.src = avatarUrl;
  avatarPreview.classList.remove('hidden');
  avatarPlaceholder.classList.add('hidden');

  if (postAvatarPreview) {
    postAvatarPreview.src = avatarUrl;
    postAvatarPreview.classList.remove('hidden');

    if (postAvatarPlaceholder) {
      postAvatarPlaceholder.classList.add('hidden');
    }
  }

  console.log('Аватар успешно сохранён!');
});



// --- СОЗДАНИЕ И ОТПРАВКА ПУБЛИКАЦИЙ ---

const createPostForm = document.getElementById('create-post-form');
const postContentInput = document.getElementById('post-content');
const submitPostBtn = document.getElementById('submit-post-btn');
const postMessage = document.getElementById('post-message');


// --- ФОТОГРАФИИ ДЛЯ ПУБЛИКАЦИИ ---

const postPhotosInput = document.getElementById('post-photos-input');
const postPhotosPreview = document.getElementById('post-photos-preview');
const postPhotosMessage = document.getElementById('post-photos-message');

let selectedPostPhotos = [];

const MAX_POST_PHOTOS = 5;
const MAX_POST_PHOTO_SIZE = 5 * 1024 * 1024;


// Выбор фотографий

postPhotosInput.addEventListener('change', () => {
  const newFiles = Array.from(postPhotosInput.files || []);

  postPhotosMessage.textContent = '';

  for (const file of newFiles) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      postPhotosMessage.textContent = 'Можно добавлять только JPG, PNG и WebP.';
      continue;
    }

    if (file.size > MAX_POST_PHOTO_SIZE) {
      postPhotosMessage.textContent = 'Размер одной фотографии не должен превышать 5 МБ.';
      continue;
    }

    if (selectedPostPhotos.length >= MAX_POST_PHOTOS) {
      postPhotosMessage.textContent = 'Можно добавить не больше 5 фотографий.';
      break;
    }

    selectedPostPhotos.push(file);
  }

  postPhotosInput.value = '';
  renderPostPhotoPreview();
});


// Предпросмотр фотографий

function renderPostPhotoPreview() {
  postPhotosPreview.innerHTML = '';

  selectedPostPhotos.forEach((file, index) => {
    const previewUrl = URL.createObjectURL(file);

    const photoElement = document.createElement('div');
    photoElement.className = 'post-photo-preview-item';

    const image = document.createElement('img');
    image.src = previewUrl;
    image.alt = 'Предпросмотр фотографии';

    image.addEventListener('load', () => {
      URL.revokeObjectURL(previewUrl);
    });

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = 'Убрать';

    removeButton.addEventListener('click', () => {
      selectedPostPhotos.splice(index, 1);
      renderPostPhotoPreview();
    });

    photoElement.append(image, removeButton);
    postPhotosPreview.appendChild(photoElement);
  });

  postPhotosMessage.textContent = selectedPostPhotos.length
    ? `Выбрано фотографий: ${selectedPostPhotos.length} из ${MAX_POST_PHOTOS}`
    : '';
}


// Очистка фотографий

function clearPostPhotos() {
  selectedPostPhotos = [];
  postPhotosInput.value = '';
  postPhotosPreview.innerHTML = '';
  postPhotosMessage.textContent = '';
}


// --- ОТПРАВКА ПУБЛИКАЦИИ ---

createPostForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const content = postContentInput.value.trim();

  if (!content) {
    postMessage.textContent = 'Напиши что-нибудь перед отправкой!';
    return;
  }

  if (content.length > 2000) {
    postMessage.textContent = 'Максимальная длина поста — 2000 символов.';
    return;
  }

  const privacyChoice = document.querySelector(
    'input[name="post-privacy"]:checked'
  );

  const isPrivate = privacyChoice?.value === 'private';

  const { data: userData, error: userError } =
    await dbClient.auth.getUser();

  if (userError || !userData.user) {
    postMessage.textContent = 'Сначала войди в аккаунт.';
    return;
  }

  const userId = userData.user.id;

  submitPostBtn.disabled = true;
  submitPostBtn.textContent = 'Отправляем...';
  postMessage.textContent = '';

  let postId = null;
  const uploadedPaths = [];

  try {
    // Создаём публикацию

    const { data: post, error: postError } = await dbClient
      .from('posts')
      .insert({
        user_id: userId,
        content: content,
        status: 'pending',
        is_private: isPrivate
      })
      .select('id')
      .single();

    if (postError) throw postError;

    postId = post.id;

    // Загружаем фотографии

    for (const file of selectedPostPhotos) {
      const extension = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp'
      }[file.type];

      const fileName = `${crypto.randomUUID()}.${extension}`;
      const storagePath = `${userId}/${postId}/${fileName}`;

      const { error: uploadError } = await dbClient.storage
        .from('post-photos')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      uploadedPaths.push(storagePath);

      // Записываем фотографию в таблицу

      const { error: photoError } = await dbClient
        .from('post_photos')
        .insert({
          post_id: postId,
          user_id: userId,
          storage_path: storagePath
        });

      if (photoError) throw photoError;
    }

    // Очищаем форму после успешной отправки

    postContentInput.value = '';
    clearPostPhotos();

    const publicRadio = document.querySelector(
      'input[name="post-privacy"][value="public"]'
    );

    if (publicRadio) {
      publicRadio.checked = true;
    }

    postMessage.textContent = 'Публикация отправлена на модерацию!';

    console.log('Публикация успешно отправлена!');

  } catch (error) {
    console.error('Ошибка отправки публикации:', error);

    // Удаляем загруженные файлы, если произошла ошибка

    if (uploadedPaths.length > 0) {
      const { error: removeError } = await dbClient.storage
        .from('post-photos')
        .remove(uploadedPaths);

      if (removeError) {
        console.error('Не удалось удалить файлы:', removeError);
      }
    }

    // Удаляем незавершённую публикацию

    if (postId) {
      const { error: deleteError } = await dbClient
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Не удалось удалить публикацию:', deleteError);
      }
    }

    postMessage.textContent =
      'Не удалось отправить публикацию. Попробуй ещё раз.';

  } finally {
    submitPostBtn.disabled = false;
    submitPostBtn.textContent = 'Отправить на модерацию';
  }
});


// Открытие модального окна
function openModal() {
  inputName.value = displayName.innerText;
  inputStatus.value = displayStatus.innerText.replace(/^статус:\s*/, '');
  inputSong.value = displaySong.innerText;
  inputArtist.value = displayArtist.innerText;

  profileModal.classList.remove('hidden');
}

editProfileBtn.addEventListener('click', openModal);
displayName.addEventListener('dblclick', openModal);
displayStatus.addEventListener('dblclick', openModal);

document.getElementById('ipod-widget').addEventListener('click', openModal);


closeBtn.addEventListener('click', () => {
  profileModal.classList.add('hidden');
});

// Сохранение профиля в Supabase
saveBtn.addEventListener('click', async () => {
  const newName = inputName.value.trim() || 'шмигулі2007';
  const newStatus = inputStatus.value.trim() || 'in love...';
  const newSong = inputSong.value.trim() || 'song name';
  const newArtist = inputArtist.value.trim() || 'author';

  // Получаем текущего пользователя
  const { data: userData, error: userError } =
    await dbClient.auth.getUser();

  if (userError || !userData.user) {
    alert('Не удалось определить пользователя. Войди в аккаунт.');
    return;
  }

  // Обновляем профиль в базе данных
  const { error } = await dbClient
    .from('profiles')
    .update({
      display_name: newName,
      status: newStatus,
      song: newSong,
      artist: newArtist
    })
    .eq('id', userData.user.id);

  if (error) {
    console.error('Ошибка сохранения профиля:', error);
    alert('Не удалось сохранить профиль. Попробуй ещё раз.');
    return;
  }

  // Обновляем отображение на странице
  displayName.innerText = newName;
  displayStatus.innerText = `статус: ${newStatus}`;
  displaySong.innerText = newSong;
  displayArtist.innerText = newArtist;

  if (postUserName) postUserName.innerText = newName;
  if (postUserStatus) postUserStatus.innerText = `статус: ${newStatus}`;

  if (postInputName) postInputName.value = newName;
  if (postInputStatus) postInputStatus.value = `статус: ${newStatus}`;

  profileModal.classList.add('hidden');

  console.log('Профиль успешно сохранён!');
});

loadProfileData();


// --- ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ---
const navBtns = document.querySelectorAll('.nav-btn');

const tabContents = {
  profile: document.getElementById('profile-section'),
  post: document.getElementById('post-section'),
  photos: document.getElementById('photos-section'),
  contact: document.getElementById('contact-section'),
  admin: document.getElementById('admin-section'),
  publicProfile: document.getElementById('public-profile-section')
};

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    navBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const selectedTab = btn.dataset.tab;

        if (
      selectedTab === 'admin' &&
      document.getElementById('admin-nav-btn').classList.contains('hidden')
    ) {
      return;
    }

    Object.values(tabContents).forEach(content => {
      if (content) content.classList.add('hidden');
    });

    if (tabContents[selectedTab]) {
      tabContents[selectedTab].classList.remove('hidden');
    }

    if (selectedTab === 'admin') {
  loadAdminPosts();
}
  });
});


// --- ПОДМЕНЮ ПРОФИЛЯ ---

const subtabBtns = document.querySelectorAll('.subtab-btn');

const profileSubcontents = {
  posts: document.getElementById('profile-posts-content'),
  wall: document.getElementById('profile-wall-content'),
  archive: document.getElementById('profile-archive-content'),
  friends: document.getElementById('profile-friends-content')
};

subtabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    subtabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const selectedTab = btn.dataset.profileTab;

    Object.values(profileSubcontents).forEach(section => {
      if (section) section.classList.add('hidden');
    });

    if (profileSubcontents[selectedTab]) {
      profileSubcontents[selectedTab].classList.remove('hidden');
    }
    if (selectedTab === 'archive') {
  loadArchive();
}
  });
});

// --- РИСОВАНИЕ НА СТЕНЕ ---

const wallCanvas = document.getElementById('wall-canvas');
const wallCtx = wallCanvas?.getContext('2d');

const wallDrawColor = document.getElementById('wall-draw-color');
const wallDrawSize = document.getElementById('wall-draw-size');
const wallClearCanvas = document.getElementById('wall-clear-canvas');

let isDrawingOnWall = false;

if (wallCanvas && wallCtx) {
  wallCtx.lineCap = 'round';
  wallCtx.lineJoin = 'round';

  wallCanvas.addEventListener('pointerdown', event => {
    isDrawingOnWall = true;
    wallCanvas.setPointerCapture(event.pointerId);

    const rect = wallCanvas.getBoundingClientRect();

    const x = (event.clientX - rect.left) *
      (wallCanvas.width / rect.width);

    const y = (event.clientY - rect.top) *
      (wallCanvas.height / rect.height);

    wallCtx.beginPath();
    wallCtx.moveTo(x, y);
  });

  wallCanvas.addEventListener('pointermove', event => {
    if (!isDrawingOnWall) return;

    const rect = wallCanvas.getBoundingClientRect();

    const x = (event.clientX - rect.left) *
      (wallCanvas.width / rect.width);

    const y = (event.clientY - rect.top) *
      (wallCanvas.height / rect.height);

    wallCtx.strokeStyle = wallDrawColor.value;
    wallCtx.lineWidth = Number(wallDrawSize.value);

    wallCtx.lineTo(x, y);
    wallCtx.stroke();
  });

  function stopWallDrawing() {
    isDrawingOnWall = false;
    wallCtx.beginPath();
  }

  wallCanvas.addEventListener('pointerup', stopWallDrawing);
  wallCanvas.addEventListener('pointercancel', stopWallDrawing);
}

wallClearCanvas?.addEventListener('click', () => {
  wallCtx?.clearRect(
    0,
    0,
    wallCanvas.width,
    wallCanvas.height
  );
});

// --- ВЕБ-КАМЕРА И РАМКИ ---
const webcam = document.getElementById('webcam');
const startCamBtn = document.getElementById('start-cam-btn');
const snapBtn = document.getElementById('snap-btn');
const frameButtons = document.querySelectorAll('.frame-btn');
const frameOverlayImg = document.getElementById('frame-overlay-img');
const photoCanvas = document.getElementById('photo-canvas');
const resultContainer = document.getElementById('result-container');
const downloadLink = document.getElementById('download-link');

let processedFrame = null;
let frameLoading = false;


// --- СИСТЕМА ФИЛЬТРОВ ---

let currentEffect = 'original';
let effectIntensity = 70;

const effects = {
  original: {
    name: 'Original'
  },
  vintage: {
    name: 'Vintage'
  },
  y2k: {
    name: 'Y2K'
  },
  vhs: {
    name: 'VHS'
  },
  dreamy: {
    name: 'Dreamy'
  }
};


// Создание панели фильтров
function createEffectPanel() {
  const panel = document.createElement('div');
  panel.id = 'photo-effects-panel';

  panel.innerHTML = `
    <div class="effects-heading">PHOTO EFFECTS</div>

    <div class="effects-buttons">
      <button type="button" class="effect-btn active" data-effect="original">
        Original
      </button>

      <button type="button" class="effect-btn" data-effect="vintage">
        Vintage
      </button>

      <button type="button" class="effect-btn" data-effect="y2k">
        Y2K
      </button>

      <button type="button" class="effect-btn" data-effect="vhs">
        VHS
      </button>

      <button type="button" class="effect-btn" data-effect="dreamy">
        Dreamy
      </button>
    </div>

    <div class="effect-intensity">
      <label for="effect-intensity">
        INTENSITY:
        <span id="effect-intensity-value">70%</span>
      </label>

      <input
        type="range"
        id="effect-intensity"
        min="0"
        max="100"
        value="70"
      >
    </div>
  `;

  const style = document.createElement('style');

  style.textContent = `
    #photo-effects-panel {
      margin-top: 15px;
      padding: 12px;
      border: 1px solid #d98abd;
      background: rgba(255, 240, 250, 0.92);
      color: #713b67;
      font-family: inherit;
      box-sizing: border-box;
      width: 100%;
    }

    .effects-heading {
      font-size: 12px;
      font-weight: bold;
      letter-spacing: 2px;
      margin-bottom: 10px;
    }

    .effects-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .effect-btn {
      padding: 7px 10px;
      border: 1px solid #d98abd;
      background: #fff8fc;
      color: #713b67;
      font-family: inherit;
      font-size: 12px;
      cursor: pointer;
    }

    .effect-btn:hover,
    .effect-btn.active {
      background: #e9a6d1;
      color: #fff;
    }

    .effect-intensity {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 7px;
      font-size: 11px;
    }

    .effect-intensity input {
      width: 100%;
      cursor: pointer;
      accent-color: #d477b5;
    }

    #vhs-preview-overlay {
      position: absolute;
      inset: 0;
      z-index: 3;
      pointer-events: none;
      display: none;
      background:
        repeating-linear-gradient(
          to bottom,
          transparent 0px,
          transparent 3px,
          rgba(0, 0, 0, 0.18) 4px
        );
      mix-blend-mode: multiply;
    }

    #vhs-preview-overlay.active {
      display: block;
    }

    #dreamy-preview-overlay {
      position: absolute;
      inset: 0;
      z-index: 3;
      pointer-events: none;
      display: none;
      background: rgba(255, 220, 245, 0.2);
      box-shadow: inset 0 0 25px rgba(255, 255, 255, 0.8);
    }

    #dreamy-preview-overlay.active {
      display: block;
    }

    #vintage-preview-overlay {
      position: absolute;
      inset: 0;
      z-index: 3;
      pointer-events: none;
      display: none;
      background:
        radial-gradient(
          ellipse,
          transparent 50%,
          rgba(90, 45, 10, 0.2) 100%
        );
    }

    #vintage-preview-overlay.active {
      display: block;
    }
  `;

  document.head.appendChild(style);

  const frameParent = frameButtons.length
    ? frameButtons[0].parentElement
    : snapBtn.parentElement;

  frameParent.appendChild(panel);

  const effectButtons = panel.querySelectorAll('.effect-btn');
  const intensityInput = panel.querySelector('#effect-intensity');
  const intensityValue = panel.querySelector('#effect-intensity-value');

  effectButtons.forEach(button => {
    button.addEventListener('click', () => {
      effectButtons.forEach(b => b.classList.remove('active'));
      button.classList.add('active');

      currentEffect = button.dataset.effect;

      updatePreviewEffect();
    });
  });

  intensityInput.addEventListener('input', () => {
    effectIntensity = Number(intensityInput.value);
    intensityValue.textContent = `${effectIntensity}%`;

    updatePreviewEffect();
  });
}


// Создание визуальных слоёв предпросмотра
function createPreviewOverlays() {
  const previewParent = webcam.parentElement;

  if (!previewParent) return;

  if (getComputedStyle(previewParent).position === 'static') {
    previewParent.style.position = 'relative';
  }

  const overlayNames = [
    'vhs-preview-overlay',
    'dreamy-preview-overlay',
    'vintage-preview-overlay'
  ];

  overlayNames.forEach(id => {
    if (!document.getElementById(id)) {
      const overlay = document.createElement('div');
      overlay.id = id;
      previewParent.appendChild(overlay);
    }
  });
}


// CSS-фильтр для живого предпросмотра
function updatePreviewEffect() {
  const amount = effectIntensity / 100;

  let filter = 'none';

  if (currentEffect === 'vintage') {
    filter = `
      sepia(${0.65 * amount})
      saturate(${1 + 0.35 * amount})
      contrast(${1 + 0.12 * amount})
      brightness(${1 + 0.04 * amount})
    `;
  }

  if (currentEffect === 'y2k') {
    filter = `
      saturate(${1 + 0.9 * amount})
      contrast(${1 + 0.2 * amount})
      hue-rotate(${-12 * amount}deg)
      brightness(${1 + 0.06 * amount})
    `;
  }

  if (currentEffect === 'vhs') {
    filter = `
      saturate(${1 + 0.5 * amount})
      contrast(${1 + 0.18 * amount})
      hue-rotate(${8 * amount}deg)
    `;
  }

  if (currentEffect === 'dreamy') {
    filter = `
      brightness(${1 + 0.2 * amount})
      saturate(${1 + 0.2 * amount})
      blur(${2 * amount}px)
    `;
  }

  webcam.style.filter = filter;

  const vhsOverlay = document.getElementById('vhs-preview-overlay');
  const dreamyOverlay = document.getElementById('dreamy-preview-overlay');
  const vintageOverlay = document.getElementById('vintage-preview-overlay');

  vhsOverlay.classList.toggle('active', currentEffect === 'vhs');
  dreamyOverlay.classList.toggle('active', currentEffect === 'dreamy');
  vintageOverlay.classList.toggle('active', currentEffect === 'vintage');

  vhsOverlay.style.opacity = amount;
  dreamyOverlay.style.opacity = amount;
  vintageOverlay.style.opacity = amount;
}


// Применение фильтра к итоговой фотографии
function applyEffectToCanvas(source, width, height) {
  const effectCanvas = document.createElement('canvas');
  const effectCtx = effectCanvas.getContext('2d');

  effectCanvas.width = width;
  effectCanvas.height = height;

  const amount = effectIntensity / 100;

  effectCtx.drawImage(source, 0, 0, width, height);

  if (currentEffect === 'original' || amount === 0) {
    return effectCanvas;
  }

  const imageData = effectCtx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Vintage, Y2K и VHS: обработка цветов
  if (
    currentEffect === 'vintage' ||
    currentEffect === 'y2k' ||
    currentEffect === 'vhs'
  ) {
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (currentEffect === 'vintage') {
        const sepiaR = r * 0.393 + g * 0.769 + b * 0.189;
        const sepiaG = r * 0.349 + g * 0.686 + b * 0.168;
        const sepiaB = r * 0.272 + g * 0.534 + b * 0.131;

        r = r + (sepiaR - r) * amount * 0.75;
        g = g + (sepiaG - g) * amount * 0.75;
        b = b + (sepiaB - b) * amount * 0.75;

        const grain = (Math.random() - 0.5) * 28 * amount;

        r += grain;
        g += grain;
        b += grain;
      }

      if (currentEffect === 'y2k') {
        r += 12 * amount;
        g += 4 * amount;
        b += 22 * amount;

        const average = (r + g + b) / 3;

        r = average + (r - average) * (1 + amount * 0.7);
        g = average + (g - average) * (1 + amount * 0.7);
        b = average + (b - average) * (1 + amount * 0.7);
      }

      if (currentEffect === 'vhs') {
        r += 18 * amount;
        b += 24 * amount;
        g -= 4 * amount;

        const average = (r + g + b) / 3;

        r = average + (r - average) * (1 + amount * 0.45);
        g = average + (g - average) * (1 + amount * 0.45);
        b = average + (b - average) * (1 + amount * 0.45);
      }

      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }

    effectCtx.putImageData(imageData, 0, 0);
  }

  // VHS: горизонтальные полосы
  if (currentEffect === 'vhs') {
    effectCtx.save();

    effectCtx.globalAlpha = 0.25 * amount;
    effectCtx.fillStyle = '#000000';

    for (let y = 0; y < height; y += 5) {
      effectCtx.fillRect(0, y, width, 1);
    }

    effectCtx.restore();

    // Лёгкие цветные смещения
    const shift = Math.round(5 * amount);

    if (shift > 0) {
      const copyCanvas = document.createElement('canvas');
      copyCanvas.width = width;
      copyCanvas.height = height;

      const copyCtx = copyCanvas.getContext('2d');
      copyCtx.drawImage(effectCanvas, 0, 0);

      effectCtx.save();
      effectCtx.globalAlpha = 0.2 * amount;
      effectCtx.globalCompositeOperation = 'screen';
      effectCtx.drawImage(copyCanvas, shift, 0);
      effectCtx.restore();
    }
  }

  // Dreamy: мягкое свечение
  if (currentEffect === 'dreamy') {
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = width;
    glowCanvas.height = height;

    const glowCtx = glowCanvas.getContext('2d');

    glowCtx.filter = `blur(${Math.max(1, 12 * amount)}px)`;
    glowCtx.drawImage(effectCanvas, 0, 0, width, height);

    effectCtx.save();
    effectCtx.globalAlpha = 0.45 * amount;
    effectCtx.globalCompositeOperation = 'screen';
    effectCtx.drawImage(glowCanvas, 0, 0);
    effectCtx.restore();

    effectCtx.save();
    effectCtx.globalAlpha = 0.12 * amount;
    effectCtx.fillStyle = '#ffe5f5';
    effectCtx.fillRect(0, 0, width, height);
    effectCtx.restore();
  }

  // Виньетка для Vintage
  if (currentEffect === 'vintage') {
    const gradient = effectCtx.createRadialGradient(
      width / 2,
      height / 2,
      width * 0.15,
      width / 2,
      height / 2,
      width * 0.75
    );

    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(65, 35, 10, ${0.35 * amount})`);

    effectCtx.fillStyle = gradient;
    effectCtx.fillRect(0, 0, width, height);
  }

  return effectCanvas;
}


function initEffectPanel() {
  const panel = document.getElementById('photo-effects-panel');

  const effectButtons = panel.querySelectorAll('.effect-btn');
  const intensityInput = panel.querySelector('#effect-intensity');
  const intensityValue = panel.querySelector('#effect-intensity-value');

  effectButtons.forEach(button => {
    button.addEventListener('click', () => {
      effectButtons.forEach(b => b.classList.remove('active'));
      button.classList.add('active');

      currentEffect = button.dataset.effect;
      updatePreviewEffect();
    });
  });

  intensityInput.addEventListener('input', () => {
    effectIntensity = Number(intensityInput.value);
    intensityValue.textContent = `${effectIntensity}%`;

    updatePreviewEffect();
  });
}

initEffectPanel();
createPreviewOverlays();


// --- ОБРАБОТКА РАМОК И УДАЛЕНИЕ ЗЕЛЁНОГО ЦВЕТА ---

function loadAndProcessFrame(src) {
  frameLoading = true;
  snapBtn.disabled = true;

  frameOverlayImg.style.visibility = 'hidden';

  const originalImage = new Image();

  originalImage.onload = () => {
    const frameCanvas = document.createElement('canvas');
    const frameCtx = frameCanvas.getContext('2d');

    frameCanvas.width = originalImage.naturalWidth;
    frameCanvas.height = originalImage.naturalHeight;

    frameCtx.drawImage(originalImage, 0, 0);

    const imageData = frameCtx.getImageData(
      0, 0,
      frameCanvas.width,
      frameCanvas.height
    );

    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const isGreen =
        g > 100 &&
        g > r * 1.35 &&
        g > b * 1.35 &&
        r < 150 &&
        b < 150;

      if (isGreen) {
        data[i + 3] = 0;
      }
    }

    frameCtx.putImageData(imageData, 0, 0);

    const processedUrl = frameCanvas.toDataURL('image/png');

    processedFrame = new Image();

    processedFrame.onload = () => {
      frameOverlayImg.src = processedUrl;
      frameOverlayImg.style.visibility = 'visible';

      frameLoading = false;

      if (webcam.srcObject && webcam.videoWidth > 0) {
        snapBtn.disabled = false;
      }
    };

    processedFrame.src = processedUrl;
  };

  originalImage.onerror = () => {
    frameLoading = false;
    snapBtn.disabled = true;
    console.error('Не удалось загрузить рамку:', src);
  };

  originalImage.src = src;
}


// Начальная рамка
loadAndProcessFrame(frameOverlayImg.getAttribute('src'));


// Включение камеры
if (startCamBtn) {
  startCamBtn.addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

      webcam.srcObject = stream;

      await webcam.play();

      startCamBtn.innerText = 'Камера включена';
      startCamBtn.disabled = true;

      updatePreviewEffect();

      if (!frameLoading && processedFrame) {
        snapBtn.disabled = false;
      }

    } catch (err) {
      alert('Не удалось получить доступ к веб-камере.');
      console.error(err);
    }
  });
}


// Смена рамок
frameButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    frameButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    loadAndProcessFrame(btn.dataset.frameImg);
  });
});


// --- СОЗДАНИЕ ФОТОГРАФИИ С ФИЛЬТРОМ ---

if (snapBtn) {
  snapBtn.addEventListener('click', () => {
    if (
      !webcam.videoWidth ||
      !webcam.videoHeight ||
      !processedFrame ||
      frameLoading
    ) {
      console.error('Камера или рамка ещё не готовы.');
      return;
    }

    const width = processedFrame.naturalWidth;
    const height = processedFrame.naturalHeight;

    photoCanvas.width = width;
    photoCanvas.height = height;

    const photoCtx = photoCanvas.getContext('2d');

    // Сначала обрабатываем изображение с камеры
    const filteredPhoto = applyEffectToCanvas(
      webcam,
      width,
      height
    );

    // Рисуем фотографию с фильтром
    photoCtx.clearRect(0, 0, width, height);
    photoCtx.drawImage(filteredPhoto, 0, 0, width, height);

    // Поверх накладываем обработанную рамку
    photoCtx.globalCompositeOperation = 'source-over';
    photoCtx.drawImage(processedFrame, 0, 0, width, height);

    // Показываем результат
    resultContainer.classList.remove('hidden');

    // Подготавливаем скачивание
    downloadLink.href = photoCanvas.toDataURL('image/png');
  });
}
console.log('Supabase loaded:', typeof window.supabase);
console.log('Client created:', typeof dbClient);
console.log('Supabase URL:', SUPABASE_URL);


// ========================================
// AUTHENTICATION SYSTEM
// ========================================

const authScreen = document.getElementById('auth-screen');
const mainApp = document.getElementById('main-app');

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const usernameForm = document.getElementById('username-form');

const authMessage = document.getElementById('auth-message');

const showLoginBtn = document.getElementById('show-login');
const showSignupBtn = document.getElementById('show-signup');

function showAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? '#c03978' : '#568b55';
}

showLoginBtn.addEventListener('click', () => {
  loginForm.classList.remove('hidden');
  signupForm.classList.add('hidden');
  usernameForm.classList.add('hidden');

  showLoginBtn.classList.add('active');
  showSignupBtn.classList.remove('active');

  authMessage.textContent = '';
});

showSignupBtn.addEventListener('click', () => {
  signupForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
  usernameForm.classList.add('hidden');

  showSignupBtn.classList.add('active');
  showLoginBtn.classList.remove('active');

  authMessage.textContent = '';
});


// Регистрация
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  showAuthMessage('Создаём аккаунт...');

  const { error } = await dbClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin
    }
  });

  if (error) {
    showAuthMessage(error.message, true);
    return;
  }

  signupForm.reset();

  showAuthMessage(
    'Аккаунт создан! Проверь почту и подтверди регистрацию.'
  );
});


// Вход
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  showAuthMessage('Выполняем вход...');

  const { error } = await dbClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showAuthMessage(error.message, true);
  }
});

let currentWallUserId = null;
let currentPublicWallOwnerId = null;
let currentWallIsAdmin = false;
// --- ПУБЛИКАЦИЯ РИСУНКА НА СТЕНЕ ---

const wallPublishDrawing = document.getElementById('wall-publish-drawing');

wallPublishDrawing?.addEventListener('click', async () => {
  if (!currentWallUserId) {
    alert('Сначала войди в аккаунт.');
    return;
  }

  if (!wallCanvas || !wallCtx) return;

  // Проверяем, нарисовано ли что-нибудь
  const pixels = wallCtx.getImageData(
    0,
    0,
    wallCanvas.width,
    wallCanvas.height
  ).data;

  let hasDrawing = false;

  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] !== 0) {
      hasDrawing = true;
      break;
    }
  }

  if (!hasDrawing) {
    alert('Сначала что-нибудь нарисуй!');
    return;
  }

  wallPublishDrawing.disabled = true;
  wallPublishDrawing.textContent = 'Публикуем...';

  try {
    const drawingBlob = await new Promise(resolve => {
      wallCanvas.toBlob(resolve, 'image/png');
    });

    if (!drawingBlob) {
      throw new Error('Не удалось создать изображение.');
    }

    const filePath = `${currentWallUserId}/${crypto.randomUUID()}.png`;

    // Загружаем рисунок в Storage
    const { error: uploadError } = await dbClient
      .storage
      .from('wall-drawings')
      .upload(filePath, drawingBlob, {
        contentType: 'image/png',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Сохраняем запись в таблице
    const { error: insertError } = await dbClient
      .from('wall_entries')
      .insert({
        wall_owner_id: currentWallUserId,
        author_id: currentWallUserId,
        drawing_path: filePath
      });

    if (insertError) {
      await dbClient.storage
        .from('wall-drawings')
        .remove([filePath]);

      throw insertError;
    }

    wallCtx.clearRect(0, 0, wallCanvas.width, wallCanvas.height);

    alert('Рисунок опубликован!');

    if (typeof loadWallEntries === 'function') {
      await loadWallEntries(currentWallUserId);
    }

  } catch (error) {
    console.error('Ошибка публикации рисунка:', error);
    alert('Не удалось опубликовать рисунок. Попробуй ещё раз.');
  } finally {
    wallPublishDrawing.disabled = false;
    wallPublishDrawing.textContent = 'Опубликовать р1сун0к';
  }
});


// --- ЗАГРУЗКА ЗАПИСЕЙ СО СТЕНЫ ---

const wallEntriesList = document.getElementById('wall-entries-list');

async function loadWallEntries(userId) {
  if (!wallEntriesList || !userId) return;

  wallEntriesList.innerHTML = '<p>Загружаем стену...</p>';

  const { data: entries, error } = await dbClient
    .from('wall_entries')
    .select(`
      *,
      author:profiles!wall_entries_author_id_fkey (
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('wall_owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Ошибка загрузки стены:', error);
    wallEntriesList.innerHTML = '<p>Не удалось загрузить записи.</p>';
    return;
  }

  if (!entries || entries.length === 0) {
    wallEntriesList.innerHTML = '<p>Пока на стене нет записей.</p>';
    return;
  }

  const entriesWithImages = await Promise.all(
    entries.map(async entry => {
      let drawingUrl = null;

      if (entry.drawing_path) {
        const { data, error } = await dbClient
          .storage
          .from('wall-drawings')
          .createSignedUrl(entry.drawing_path, 3600);

        if (!error && data) {
          drawingUrl = data.signedUrl;
        }
      }

      return { ...entry, drawingUrl };
    })
  );

  wallEntriesList.innerHTML = entriesWithImages.map(entry => {
    const author = entry.author || {};
    const name = escapePostHTML(
      author.display_name || author.username || 'Пользователь'
    );

    const username = escapePostHTML(author.username || 'user');
    const avatar = author.avatar_url
      ? `<img src="${escapePostHTML(author.avatar_url)}" alt="">`
      : '';

    const date = new Date(entry.created_at).toLocaleString('ru-RU');

    const content = entry.content
      ? `<p class="wall-entry-text">${escapePostHTML(entry.content)}</p>`
      : '';

    const drawing = entry.drawingUrl
      ? `<img class="wall-entry-drawing" src="${escapePostHTML(entry.drawingUrl)}" alt="Рисунок на стене">`
      : '';

    return `
      <div class="wall-entry" data-entry-id="${escapePostHTML(entry.id)}">
        <div class="wall-entry-author">
          <div class="wall-entry-avatar">${avatar}</div>
          <div>
            <strong>${name}</strong>
            <span>@${username}</span>
            <small>${escapePostHTML(date)}</small>
          </div>
        </div>

        ${content}
        ${drawing}

        <button
          type="button"
          class="y2k-btn delete-wall-entry"
          data-entry-id="${escapePostHTML(entry.id)}"
        >
          Удалить
        </button>
      </div>
    `;
  }).join('');
}

// --- ПУБЛИКАЦИЯ ТЕКСТОВЫХ ЗАПИСЕЙ ---

const wallTextForm = document.getElementById('wall-text-form');
const wallTextInput = document.getElementById('wall-text-input');

wallTextForm?.addEventListener('submit', async event => {
  event.preventDefault();

  if (!currentWallUserId) {
    alert('Сначала войди в аккаунт.');
    return;
  }

  const content = wallTextInput.value.trim();

  if (!content) {
    alert('Напиши что-нибудь!');
    return;
  }

  if (content.length > 2000) {
    alert('Максимум 2000 символов.');
    return;
  }

  const submitButton = wallTextForm.querySelector(
    'button[type="submit"]'
  );

  submitButton.disabled = true;
  submitButton.textContent = 'Публикуем...';

  try {
    const { error } = await dbClient
      .from('wall_entries')
      .insert({
        wall_owner_id: currentWallUserId,
        author_id: currentWallUserId,
        content: content
      });

    if (error) throw error;

    wallTextInput.value = '';

    await loadWallEntries(currentWallUserId);

  } catch (error) {
    console.error('Ошибка публикации записи:', error);
    alert('Не удалось опубликовать запись.');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Опубликовать запись';
  }
});

// --- УДАЛЕНИЕ ЗАПИСЕЙ СО СТЕНЫ ---

wallEntriesList?.addEventListener('click', async event => {
  const button = event.target.closest('.delete-wall-entry');

  if (!button) return;

  const entryId = button.dataset.entryId;

  if (!confirm('Удалить эту запись со стены?')) return;

  button.disabled = true;

  try {
    const { data: entry, error: fetchError } = await dbClient
      .from('wall_entries')
      .select('id, drawing_path')
      .eq('id', entryId)
      .single();

    if (fetchError) throw fetchError;

    if (entry.drawing_path) {
      const { error: storageError } = await dbClient
        .storage
        .from('wall-drawings')
        .remove([entry.drawing_path]);

      if (storageError) throw storageError;
    }

    const { error: deleteError } = await dbClient
      .from('wall_entries')
      .delete()
      .eq('id', entryId);

    if (deleteError) throw deleteError;

    await loadWallEntries(currentWallUserId);

  } catch (error) {
    console.error('Ошибка удаления записи:', error);
    alert('Не удалось удалить запись.');
    button.disabled = false;
  }
});

// Проверка профиля пользователя
async function handleUserSession(session) {
  if (!session) {
    currentWallUserId = null;
    mainApp.classList.add('hidden');
    authScreen.classList.remove('hidden');

    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    usernameForm.classList.add('hidden');

    document.getElementById('admin-nav-btn').classList.add('hidden');
    document.getElementById('admin-section').classList.add('hidden');

    return;
  }

  currentWallUserId = session.user.id;

  const { data: profile, error } = await dbClient
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    mainApp.classList.add('hidden');
    authScreen.classList.remove('hidden');

    showAuthMessage(
      'Не удалось загрузить профиль. Попробуй обновить страницу.',
      true
    );

    console.error('Ошибка загрузки профиля:', error);
    return;
  }

  currentWallIsAdmin = profile.is_admin === true;

  // Если пользователь ещё не придумал имя
  if (profile.username.startsWith('user_')) {
    mainApp.classList.add('hidden');
    authScreen.classList.remove('hidden');

    loginForm.classList.add('hidden');
    signupForm.classList.add('hidden');
    usernameForm.classList.remove('hidden');

    showAuthMessage('Остался последний шаг!');

    return;
  }

  // Пользователь авторизован
  authScreen.classList.add('hidden');
  mainApp.classList.remove('hidden');

// Доступ к админ-панели
const adminNavBtn = document.getElementById('admin-nav-btn');
const adminSection = document.getElementById('admin-section');

if (profile.is_admin === true) {
  adminNavBtn.classList.remove('hidden');
} else {
  adminNavBtn.classList.add('hidden');
  adminSection.classList.add('hidden');
}

  // Загружаем текстовые данные профиля
  displayName.textContent = profile.display_name || profile.username;

  displayStatus.textContent = profile.status
    ? `статус: ${profile.status}`
    : 'статус: just exploring...';

  displaySong.textContent = profile.song || 'song name';
  displayArtist.textContent = profile.artist || 'author';

  if (postUserName) {
    postUserName.textContent = displayName.textContent;
  }

  if (postUserStatus) {
    postUserStatus.textContent = displayStatus.textContent;
  }

  if (postInputName) {
    postInputName.value = displayName.textContent;
  }

  if (postInputStatus) {
    postInputStatus.value = displayStatus.textContent;
  }

  // Загружаем аватар из Supabase
  if (profile.avatar_url) {
    avatarPreview.src = profile.avatar_url;
    avatarPreview.classList.remove('hidden');
    avatarPlaceholder.classList.add('hidden');

    if (postAvatarPreview) {
      postAvatarPreview.src = profile.avatar_url;
      postAvatarPreview.classList.remove('hidden');

      if (postAvatarPlaceholder) {
        postAvatarPlaceholder.classList.add('hidden');
      }
    }
  } else {
    avatarPreview.src = '';
    avatarPreview.classList.add('hidden');
    avatarPlaceholder.classList.remove('hidden');

    if (postAvatarPreview) {
      postAvatarPreview.src = '';
      postAvatarPreview.classList.add('hidden');
    }

    if (postAvatarPlaceholder) {
      postAvatarPlaceholder.classList.remove('hidden');
    }
  }

  // Загружаем публичную ленту
await loadFeed();

await loadWallEntries(currentWallUserId);

  // Загружаем входящие заявки в друзья
  await loadIncomingFriendRequests();

    // Загружаем список друзей
  await loadFriendsList();

  await loadOutgoingFriendRequests();
}



// Создание имени профиля
usernameForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document
    .getElementById('username-input')
    .value
    .trim()
    .toLowerCase();

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    showAuthMessage(
      'Используй 3–20 символов: латинские буквы, цифры и _. ',
      true
    );
    return;
  }

  const { data: userData } = await dbClient.auth.getUser();

  if (!userData.user) {
    showAuthMessage('Сначала войди в аккаунт.', true);
    return;
  }

  showAuthMessage('Создаём профиль...');

  const { error } = await dbClient
    .from('profiles')
    .update({
      username: username,
      display_name: username
    })
    .eq('id', userData.user.id);

  if (error) {
    if (error.code === '23505') {
      showAuthMessage('Это имя уже занято. Придумай другое.', true);
    } else {
      showAuthMessage(error.message, true);
    }

    return;
  }

  usernameForm.reset();

  const { data: sessionData } = await dbClient.auth.getSession();

  await handleUserSession(sessionData.session);
});


// Кнопка выхода
const logoutBtn = document.createElement('button');

logoutBtn.type = 'button';
logoutBtn.className = 'y2k-btn';
logoutBtn.textContent = 'Выйти из аккаунта';

editProfileBtn.parentElement.appendChild(logoutBtn);

logoutBtn.addEventListener('click', async () => {
  const { error } = await dbClient.auth.signOut();

  if (error) {
    alert('Не удалось выйти из аккаунта.');
    console.error(error);
  }
});


// Проверка текущей сессии
async function initAuthentication() {
  const { data, error } = await dbClient.auth.getSession();

  if (error) {
    showAuthMessage('Ошибка проверки авторизации.', true);
    return;
  }

  await handleUserSession(data.session);

  dbClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      setTimeout(() => {
        handleUserSession(session);
      }, 0);
    }
  });
}

initAuthentication();



// --- ПОИСК ПОЛЬЗОВАТЕЛЕЙ ДЛЯ ДРУЗЕЙ ---

async function searchFriendsUsers() {
  const input = document.getElementById('friends-search-input');
  const results = document.getElementById('friends-search-results');

  const query = input.value.trim();

  if (query.length < 2) {
    results.textContent = 'Введи минимум 2 символа для поиска.';
    return;
  }

  results.textContent = 'Ищем пользователей...';

  const { data: userData, error: authError } =
    await dbClient.auth.getUser();

  if (authError || !userData.user) {
    results.textContent = 'Необходимо войти в аккаунт.';
    return;
  }

  const { data: users, error } = await dbClient
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .ilike('username', `%${query}%`)
    .neq('id', userData.user.id)
    .limit(10);

  if (error) {
    console.error(error);
    results.textContent = 'Не удалось выполнить поиск.';
    return;
  }

  results.replaceChildren();

  if (!users || users.length === 0) {
    results.textContent = 'Пользователи не найдены.';
    return;
  }

  users.forEach(user => {
    const card = document.createElement('div');
    card.className = 'friend-user-card';

    const info = document.createElement('div');
    info.className = 'friend-user-info';

    info.style.cursor = 'pointer';

info.addEventListener('click', () => {
  openPublicProfile(friendId);
});

    if (user.avatar_url) {
      const avatar = document.createElement('img');
      avatar.src = user.avatar_url;
      avatar.alt = 'Аватар';
      avatar.className = 'friend-avatar';
      info.appendChild(avatar);
    }

    const name = document.createElement('strong');
    name.textContent = user.display_name || user.username;

    const username = document.createElement('span');
    username.textContent = '@' + user.username;

    info.append(name, username);

    const button = document.createElement('button');
    button.className = 'y2k-btn friend-request-btn';
    button.textContent = 'Добавить в друзья';

    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Отправляем...';

      const { data: currentUser } = await dbClient.auth.getUser();

      if (!currentUser.user) {
        button.disabled = false;
        button.textContent = 'Добавить в друзья';
        return;
      }

      const { error: requestError } = await dbClient
        .from('friend_requests')
        .insert({
          sender_id: currentUser.user.id,
          receiver_id: user.id
        });

      if (requestError) {
        console.error(requestError);

        button.disabled = false;
        button.textContent = 'Добавить в друзья';

        alert(
          requestError.code === '23505'
            ? 'Заявка уже отправлена или вы уже друзья.'
            : 'Не удалось отправить заявку.'
        );

        return;
      }

      button.textContent = 'Заявка отправлена';
      await loadOutgoingFriendRequests();
    });

    card.append(info, button);
    results.appendChild(card);
  });
}




// --- ВОЗВРАТ ИЗ ЧУЖОГО ПРОФИЛЯ ---

document.getElementById('back-to-profile-btn').addEventListener('click', () => {
  Object.values(tabContents).forEach(section => {
    section.classList.add('hidden');
  });

  document.getElementById('profile-section').classList.remove('hidden');
});





// --- ИНИЦИАЛИЗАЦИЯ ПОИСКА ДРУЗЕЙ ---

function initFriendsSearch() {
  const searchButton = document.getElementById('friends-search-btn');
  const searchInput = document.getElementById('friends-search-input');

  if (!searchButton || !searchInput) return;

  searchButton.addEventListener('click', searchFriendsUsers);

  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      searchFriendsUsers();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFriendsSearch);
} else {
  initFriendsSearch();
}


// --- ЗАГРУЗКА ВХОДЯЩИХ ЗАЯВОК ---

async function loadIncomingFriendRequests() {
  const container = document.getElementById('incoming-requests');

  if (!container) return;

  const { data: userData } = await dbClient.auth.getUser();

  if (!userData.user) return;

  container.textContent = 'Загружаем заявки...';

  const { data: requests, error } = await dbClient
    .from('friend_requests')
    .select(`
      id,
      sender_id,
      created_at,
      profiles:sender_id (
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('receiver_id', userData.user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    container.textContent = 'Не удалось загрузить заявки.';
    return;
  }

  container.replaceChildren();

  if (!requests || requests.length === 0) {
    container.textContent = 'Пока нет входящих заявок.';
    return;
  }

  requests.forEach(request => {
    const card = document.createElement('div');
    card.className = 'friend-user-card';

    const info = document.createElement('div');
    info.className = 'friend-user-info';

    const name = document.createElement('strong');
    name.textContent =
      request.profiles?.display_name ||
      request.profiles?.username ||
      'Пользователь';

    const username = document.createElement('span');
    username.textContent =
      '@' + (request.profiles?.username || 'unknown');

    info.append(name, username);

    const actions = document.createElement('div');
    actions.className = 'friend-request-actions';

    const acceptButton = document.createElement('button');
    acceptButton.className = 'y2k-btn';
    acceptButton.textContent = 'Принять';

    const rejectButton = document.createElement('button');
    rejectButton.className = 'y2k-btn';
    rejectButton.textContent = 'Отклонить';

    acceptButton.addEventListener('click', async () => {
      await respondToFriendRequest(request.id, 'accepted');
    });

    rejectButton.addEventListener('click', async () => {
      await respondToFriendRequest(request.id, 'rejected');
    });

    actions.append(acceptButton, rejectButton);
    card.append(info, actions);
    container.appendChild(card);
  });
}


// --- ПРИНЯТИЕ И ОТКЛОНЕНИЕ ЗАЯВОК ---

async function respondToFriendRequest(requestId, status) {
  const { error } = await dbClient.rpc(
    'respond_to_friend_request',
    {
      p_request_id: requestId,
      p_status: status
    }
  );

  if (error) {
    console.error(error);
    alert('Не удалось обработать заявку.');
    return;
  }

  await loadIncomingFriendRequests();
  await loadFriendsList();
}



// --- ПРОВЕРКА СТАТУСА ДРУЖБЫ В ПУБЛИЧНОМ ПРОФИЛЕ ---

async function loadPublicProfileFriendButton(userId) {
  const friendBtn = document.getElementById('public-profile-friend-btn');

  const { data: userData } = await dbClient.auth.getUser();

  if (!userData.user) return;

  const currentUserId = userData.user.id;

  friendBtn.dataset.userId = userId;
  friendBtn.disabled = false;
  friendBtn.classList.remove('hidden');

  if (currentUserId === userId) {
    friendBtn.classList.add('hidden');
    return;
  }

  const { data: requests, error } = await dbClient
    .from('friend_requests')
    .select('id, sender_id, receiver_id, status')
    .or(
      `and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`
    )
    .in('status', ['pending', 'accepted']);

  if (error) {
    console.error('Ошибка проверки дружбы:', error);
    friendBtn.textContent = 'Не удалось проверить дружбу';
    friendBtn.disabled = true;
    return;
  }

  const request = requests?.[0];

  if (!request) {
    friendBtn.textContent = 'Добавить в друзья';
    friendBtn.dataset.action = 'send';
    return;
  }

  friendBtn.dataset.requestId = request.id;

  if (request.status === 'accepted') {
    friendBtn.textContent = 'Вы друзья';
    friendBtn.dataset.action = 'none';
    friendBtn.disabled = true;
    return;
  }

  if (request.sender_id === currentUserId) {
    friendBtn.textContent = 'Заявка отправлена';
    friendBtn.dataset.action = 'none';
    friendBtn.disabled = true;
    return;
  }

  friendBtn.textContent = 'Принять заявку';
  friendBtn.dataset.action = 'accept';
}


// --- ЗАГРУЗКА СПИСКА ДРУЗЕЙ ---

async function loadFriendsList() {
  const container = document.getElementById('friends-list');

  if (!container) return;

  const { data: userData } = await dbClient.auth.getUser();

  if (!userData.user) return;

  const currentUserId = userData.user.id;

  container.textContent = 'Загружаем друзей...';

  const { data: requests, error } = await dbClient
    .from('friend_requests')
    .select(`
      id,
      sender_id,
      receiver_id,
      sender:profiles!friend_requests_sender_id_fkey (
        username,
        display_name,
        avatar_url
      ),
      receiver:profiles!friend_requests_receiver_id_fkey (
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('status', 'accepted')
    .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Ошибка загрузки друзей:', error);
    container.textContent = 'Не удалось загрузить друзей.';
    return;
  }

  container.replaceChildren();

  if (!requests || requests.length === 0) {
    container.textContent = 'Пока здесь никого нет.';
    return;
  }

  requests.forEach(request => {
    // Определяем друга
    const friend = request.sender_id === currentUserId
      ? request.receiver
      : request.sender;

    const friendId = request.sender_id === currentUserId
      ? request.receiver_id
      : request.sender_id;

    if (!friend) return;

    const card = document.createElement('div');
    card.className = 'friend-user-card';

    const info = document.createElement('div');
    info.className = 'friend-user-info';
    info.style.cursor = 'pointer';

    // Открытие профиля друга
    info.addEventListener('click', () => {
      openPublicProfile(friendId);
    });

    if (friend.avatar_url) {
      const avatar = document.createElement('img');
      avatar.src = friend.avatar_url;
      avatar.alt = 'Аватар';
      avatar.className = 'friend-avatar';
      info.appendChild(avatar);
    }

    const name = document.createElement('strong');
    name.textContent = friend.display_name || friend.username;

    const username = document.createElement('span');
    username.textContent = '@' + friend.username;

    info.append(name, username);

    // Кнопка удаления из друзей
    const removeButton = document.createElement('button');
    removeButton.className = 'y2k-btn';
    removeButton.textContent = 'Удалить из друзей';

    removeButton.addEventListener('click', async () => {
      const confirmed = confirm(
        `Удалить @${friend.username} из друзей?`
      );

      if (!confirmed) return;

      removeButton.disabled = true;

      const { error: deleteError } = await dbClient
        .from('friend_requests')
        .delete()
        .eq('id', request.id)
        .eq('status', 'accepted');

      if (deleteError) {
        console.error(deleteError);
        alert('Не удалось удалить друга.');
        removeButton.disabled = false;
        return;
      }

      await loadFriendsList();
    });

    card.append(info, removeButton);
    container.appendChild(card);
  });
}






// --- ОТКРЫТИЕ ЧУЖОГО ПРОФИЛЯ ---


async function openPublicProfile(userId) {
currentPublicWallOwnerId = userId;
  const { data: profile, error } = await dbClient
    .from('profiles')
    .select('id, username, display_name, status, song, artist, avatar_url')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    console.error(error);
    alert('Не удалось загрузить профиль.');
    return;
  }

  // Данные профиля
  document.getElementById('public-profile-name').textContent =
    profile.display_name || profile.username;

  document.getElementById('public-profile-username').textContent =
    '@' + profile.username;

  document.getElementById('public-profile-status').textContent =
    profile.status || 'Без статуса';

  document.getElementById('public-profile-song').textContent =
    profile.song || 'Трек не указан';

  document.getElementById('public-profile-artist').textContent =
    profile.artist || 'Исполнитель не указан';

  // Аватар
  const avatar = document.getElementById('public-profile-avatar');
  const placeholder = document.getElementById('public-profile-avatar-placeholder');

  if (profile.avatar_url) {
    avatar.src = profile.avatar_url;
    avatar.classList.remove('hidden');
    placeholder.classList.add('hidden');
  } else {
    avatar.src = '';
    avatar.classList.add('hidden');
    placeholder.classList.remove('hidden');
  }

  // Кнопка дружбы
  const friendBtn = document.getElementById('public-profile-friend-btn');


  friendBtn.dataset.userId = userId;
  friendBtn.classList.remove('hidden');
  friendBtn.textContent = 'Добавить в друзья';

await loadPublicWallEntries(userId);

  // Проверяем статус дружбы
  await loadPublicProfileFriendButton(userId);

  // Публикации
  await loadPublicProfilePosts(userId);

  // Показываем страницу профиля
  Object.values(tabContents).forEach(section => {
    section.classList.add('hidden');
  });

  document.getElementById('public-profile-section').classList.remove('hidden');


}



async function sendPublicProfileFriendRequest() {
  const friendBtn = document.getElementById('public-profile-friend-btn');
  const receiverId = friendBtn.dataset.userId;
  const action = friendBtn.dataset.action;

  if (!receiverId || !action || action === 'none') return;

  friendBtn.disabled = true;

  // Отправка заявки
  if (action === 'send') {
    const { data: userData } = await dbClient.auth.getUser();

    if (!userData.user) {
      alert('Необходимо войти в аккаунт.');
      friendBtn.disabled = false;
      return;
    }

    const { error } = await dbClient
      .from('friend_requests')
      .insert({
        sender_id: userData.user.id,
        receiver_id: receiverId
      });

    if (error) {
      console.error(error);
      alert('Не удалось отправить заявку.');
      await loadPublicProfileFriendButton(receiverId);
      return;
    }

    await loadOutgoingFriendRequests();
    await loadPublicProfileFriendButton(receiverId);
    return;
  }

  // Принятие входящей заявки
  if (action === 'accept') {
    const requestId = friendBtn.dataset.requestId;

    if (!requestId) {
      friendBtn.disabled = false;
      return;
    }

    await respondToFriendRequest(requestId, 'accepted');
    await loadPublicProfileFriendButton(receiverId);
  }
}
document
  .getElementById('public-profile-friend-btn')
  .addEventListener('click', sendPublicProfileFriendRequest);

document
  .getElementById('public-profile-friend-btn')
  .addEventListener('click', sendPublicProfileFriendRequest);


// --- ПУБЛИКАЦИИ ЧУЖОГО ПРОФИЛЯ ---

async function loadPublicProfilePosts(userId) {
  const container = document.getElementById('public-profile-posts');

  container.innerHTML = '<p>Загружаем публикации...</p>';

  const { data: posts, error } = await dbClient
    .from('posts')
    .select(`
      id,
      content,
      created_at,
      post_photos (
        storage_path
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'approved')
    .eq('is_private', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    container.textContent = 'Не удалось загрузить публикации.';
    return;
  }

  container.innerHTML = '';

  if (!posts || posts.length === 0) {
    container.textContent = 'Пока нет публичных публикаций.';
    return;
  }

  for (const post of posts) {
    const card = document.createElement('div');
    card.className = 'post-card';

    const date = document.createElement('p');
    date.className = 'post-date';
    date.textContent = new Date(post.created_at).toLocaleString('ru-RU');

    const content = document.createElement('p');
    content.className = 'post-content';
    content.textContent = post.content || '';

    card.append(date, content);

    for (const photo of post.post_photos || []) {
      const { data: imageData, error: imageError } =
        await dbClient.storage
          .from('post-photos')
          .createSignedUrl(photo.storage_path, 3600);

      if (imageError) {
        console.error(imageError);
        continue;
      }

      const image = document.createElement('img');
      image.src = imageData.signedUrl;
      image.alt = 'Фотография публикации';
      image.className = 'post-photo';

      card.appendChild(image);
    }

    container.appendChild(card);
  }
}

// --- ЗАГРУЗКА ОТПРАВЛЕННЫХ ЗАЯВОК ---

async function loadOutgoingFriendRequests() {
  const container = document.getElementById('outgoing-requests');

  if (!container) return;

  const { data: userData } = await dbClient.auth.getUser();

  if (!userData.user) return;

  container.textContent = 'Загружаем заявки...';

  const { data: requests, error } = await dbClient
    .from('friend_requests')
    .select(`
      id,
      receiver:profiles!friend_requests_receiver_id_fkey (
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('sender_id', userData.user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    container.textContent = 'Не удалось загрузить заявки.';
    return;
  }

  container.replaceChildren();

  if (!requests || requests.length === 0) {
    container.textContent = 'Ты пока никому не отправляла заявки.';
    return;
  }

  requests.forEach(request => {
    const user = request.receiver;

    if (!user) return;

    const card = document.createElement('div');
    card.className = 'friend-user-card';

    const info = document.createElement('div');
    info.className = 'friend-user-info';

    info.style.cursor = 'pointer';

info.addEventListener('click', () => {
  openPublicProfile(friend.id);
});

    if (user.avatar_url) {
      const avatar = document.createElement('img');
      avatar.src = user.avatar_url;
      avatar.alt = 'Аватар';
      avatar.className = 'friend-avatar';
      info.appendChild(avatar);
    }

    const name = document.createElement('strong');
    name.textContent = user.display_name || user.username;

    const username = document.createElement('span');
    username.textContent = '@' + user.username;

    info.append(name, username);

    const cancelButton = document.createElement('button');
    cancelButton.className = 'y2k-btn';
    cancelButton.textContent = 'Отменить';

    cancelButton.addEventListener('click', async () => {
      const confirmed = confirm('Отменить заявку?');

      if (!confirmed) return;

      cancelButton.disabled = true;

      const { error: deleteError } = await dbClient
        .from('friend_requests')
        .delete()
        .eq('id', request.id)
        .eq('sender_id', userData.user.id);

      if (deleteError) {
        console.error(deleteError);
        alert('Не удалось отменить заявку.');
        cancelButton.disabled = false;
        return;
      }

      await loadOutgoingFriendRequests();
    });

    card.append(info, cancelButton);
    container.appendChild(card);
  });
}


// --- ПУБЛИЧНАЯ СТЕНА: ЗАГРУЗКА ЗАПИСЕЙ ---

const publicWallEntriesList = document.getElementById(
  'public-wall-entries-list'
);

async function loadPublicWallEntries(userId) {
  if (!publicWallEntriesList || !userId) return;

  publicWallEntriesList.innerHTML = '<p>Загружаем стену...</p>';

  const { data: entries, error } = await dbClient
    .from('wall_entries')
    .select(`
      *,
      author:profiles!wall_entries_author_id_fkey (
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('wall_owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Ошибка загрузки публичной стены:', error);
    publicWallEntriesList.innerHTML = '<p>Не удалось загрузить стену.</p>';
    return;
  }

  if (!entries || entries.length === 0) {
    publicWallEntriesList.innerHTML = '<p>Пока на стене нет записей.</p>';
    return;
  }

  const entriesWithImages = await Promise.all(
    entries.map(async entry => {
      let drawingUrl = null;

      if (entry.drawing_path) {
        const { data, error } = await dbClient
          .storage
          .from('wall-drawings')
          .createSignedUrl(entry.drawing_path, 3600);

        if (!error && data) {
          drawingUrl = data.signedUrl;
        }
      }

      return { ...entry, drawingUrl };
    })
  );

  publicWallEntriesList.innerHTML = entriesWithImages.map(entry => {
    const author = entry.author || {};

    const name = escapePostHTML(
      author.display_name || author.username || 'Пользователь'
    );

    const username = escapePostHTML(author.username || 'user');

    const avatar = author.avatar_url
      ? `<img src="${escapePostHTML(author.avatar_url)}" alt="">`
      : '';

    const date = new Date(entry.created_at).toLocaleString('ru-RU');

    const content = entry.content
      ? `<p class="wall-entry-text">${escapePostHTML(entry.content)}</p>`
      : '';

    const drawing = entry.drawingUrl
      ? `<img class="wall-entry-drawing" src="${escapePostHTML(entry.drawingUrl)}" alt="Рисунок на стене">`
      : '';

    const canDelete =
      entry.author_id === currentWallUserId ||
      entry.wall_owner_id === currentWallUserId ||
      currentWallIsAdmin;

    return `
      <div class="wall-entry" data-entry-id="${escapePostHTML(entry.id)}">
        <div class="wall-entry-author">
          <div class="wall-entry-avatar">${avatar}</div>
          <div>
            <strong>${name}</strong>
            <span>@${username}</span>
            <small>${escapePostHTML(date)}</small>
          </div>
        </div>

        ${content}
        ${drawing}

        ${canDelete ? `
          <button
            type="button"
            class="y2k-btn delete-public-wall-entry"
            data-entry-id="${escapePostHTML(entry.id)}"
          >
            Удалить
          </button>
        ` : ''}
      </div>
    `;
  }).join('');
}


// --- ПУБЛИЧНАЯ СТЕНА: ОТПРАВКА ТЕКСТА ---

const publicWallTextForm = document.getElementById(
  'public-wall-text-form'
);

const publicWallTextInput = document.getElementById(
  'public-wall-text-input'
);

publicWallTextForm?.addEventListener('submit', async event => {
  event.preventDefault();

  if (!currentWallUserId || !currentPublicWallOwnerId) {
    alert('Не удалось определить пользователя.');
    return;
  }

  const content = publicWallTextInput.value.trim();

  if (!content) {
    alert('Напиши что-нибудь!');
    return;
  }

  const submitButton = publicWallTextForm.querySelector(
    'button[type="submit"]'
  );

  submitButton.disabled = true;

  try {
    const { error } = await dbClient
      .from('wall_entries')
      .insert({
        wall_owner_id: currentPublicWallOwnerId,
        author_id: currentWallUserId,
        content: content
      });

    if (error) throw error;

    publicWallTextInput.value = '';

    await loadPublicWallEntries(currentPublicWallOwnerId);

  } catch (error) {
    console.error('Ошибка публикации на чужой стене:', error);
    alert('Не удалось оставить запись.');
  } finally {
    submitButton.disabled = false;
  }
});


// --- РИСОВАНИЕ НА ЧУЖОЙ СТЕНЕ ---

const publicWallCanvas = document.getElementById('public-wall-canvas');
const publicWallCtx = publicWallCanvas?.getContext('2d');

const publicWallDrawColor = document.getElementById('public-wall-draw-color');
const publicWallDrawSize = document.getElementById('public-wall-draw-size');
const publicWallClearCanvas = document.getElementById('public-wall-clear-canvas');
const publicWallPublishDrawing = document.getElementById('public-wall-publish-drawing');

let isDrawingOnPublicWall = false;

if (publicWallCanvas && publicWallCtx) {
  publicWallCtx.lineCap = 'round';
  publicWallCtx.lineJoin = 'round';

  publicWallCanvas.addEventListener('pointerdown', event => {
    isDrawingOnPublicWall = true;
    publicWallCanvas.setPointerCapture(event.pointerId);

    const rect = publicWallCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (publicWallCanvas.width / rect.width);
    const y = (event.clientY - rect.top) * (publicWallCanvas.height / rect.height);

    publicWallCtx.beginPath();
    publicWallCtx.moveTo(x, y);
  });

  publicWallCanvas.addEventListener('pointermove', event => {
    if (!isDrawingOnPublicWall) return;

    const rect = publicWallCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (publicWallCanvas.width / rect.width);
    const y = (event.clientY - rect.top) * (publicWallCanvas.height / rect.height);

    publicWallCtx.strokeStyle = publicWallDrawColor.value;
    publicWallCtx.lineWidth = Number(publicWallDrawSize.value);

    publicWallCtx.lineTo(x, y);
    publicWallCtx.stroke();
  });

  function stopPublicWallDrawing() {
    isDrawingOnPublicWall = false;
    publicWallCtx.beginPath();
  }

  publicWallCanvas.addEventListener('pointerup', stopPublicWallDrawing);
  publicWallCanvas.addEventListener('pointercancel', stopPublicWallDrawing);
}

// Очистка холста

publicWallClearCanvas?.addEventListener('click', () => {
  publicWallCtx?.clearRect(
    0,
    0,
    publicWallCanvas.width,
    publicWallCanvas.height
  );
});

// Публикация рисунка

publicWallPublishDrawing?.addEventListener('click', async () => {
  if (!currentWallUserId || !currentPublicWallOwnerId) {
    alert('Не удалось определить пользователя.');
    return;
  }

  if (!publicWallCanvas || !publicWallCtx) return;

  const imageData = publicWallCtx.getImageData(
    0,
    0,
    publicWallCanvas.width,
    publicWallCanvas.height
  );

  const hasDrawing = imageData.data.some((value, index) => {
    return index % 4 === 3 && value !== 0;
  });

  if (!hasDrawing) {
    alert('Сначала нарисуй что-нибудь!');
    return;
  }

  publicWallPublishDrawing.disabled = true;

  try {
    const blob = await new Promise(resolve => {
      publicWallCanvas.toBlob(resolve, 'image/png');
    });

    if (!blob) {
      throw new Error('Не удалось создать изображение.');
    }

    const filePath = `${currentWallUserId}/${crypto.randomUUID()}.png`;

    const { error: uploadError } = await dbClient
      .storage
      .from('wall-drawings')
      .upload(filePath, blob, {
        contentType: 'image/png',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { error: insertError } = await dbClient
      .from('wall_entries')
      .insert({
        wall_owner_id: currentPublicWallOwnerId,
        author_id: currentWallUserId,
        drawing_path: filePath
      });

    if (insertError) {
      await dbClient
        .storage
        .from('wall-drawings')
        .remove([filePath]);

      throw insertError;
    }

    publicWallCtx.clearRect(
      0,
      0,
      publicWallCanvas.width,
      publicWallCanvas.height
    );

    await loadPublicWallEntries(currentPublicWallOwnerId);

    alert('Рисунок опубликован!');

  } catch (error) {
    console.error('Ошибка публикации рисунка:', error);
    alert('Не удалось опубликовать рисунок.');
  } finally {
    publicWallPublishDrawing.disabled = false;
  }
});