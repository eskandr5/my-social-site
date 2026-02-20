// استبدل الرابط أدناه برابط مشروعك الحقيقي على Render
const API_URL = "https://my-social-api-ytg6.onrender.com";
// دالة مساعدة لمعالجة روابط الصور سواء كانت محلية أو سحابية
function getFullUrl(url) {
    if (!url) return "";
    return url.startsWith('http') ? url : `${API_URL}${url}`;
}
// ===========================================================================================================================
// ===========================================================================================================================

async function registerUser() {
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const msgElement = document.getElementById('reg-msg');

    try {
        const response = await fetch(`${API_URL}/api/auth/local/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }),
        });

        const data = await response.json();

        if (response.ok) {
            msgElement.style.color = "green";
            msgElement.innerText = "تم إنشاء الحساب بنجاح! يمكنك تسجيل الدخول الآن.";
        } else {
            msgElement.style.color = "red";
            msgElement.innerText = "خطأ: " + data.error.message;
        }
    } catch (error) {
        msgElement.innerText = "فشل الاتصال بالسيرفر.";
    }
}
// ===========================================================================================================================
// ===========================================================================================================================
// التحقق من حالة تسجيل الدخول وتحديث الواجهة
function checkLogin() {
    const user = localStorage.getItem('user');
    const createPostArea = document.getElementById('create-post-area');
    const userDisplayName = document.getElementById('user-display-name');

    if (user) {
        const userData = JSON.parse(user);
        if (createPostArea) createPostArea.style.display = 'block';
        if (userDisplayName) userDisplayName.innerHTML = `<span onclick="showProfile()" style="cursor:pointer; text-decoration:underline; color:#1877f2;">${userData.username}</span>`;
    } else {
        if (createPostArea) createPostArea.style.display = 'none';
    }
}
// ===========================================================================================================================
// ===========================================================================================================================

// التأكد من صلاحية التوكن عند فتح الصفحة
async function checkUserSession() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/api/users/me`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const userData = await response.json();
            localStorage.setItem('user', JSON.stringify(userData));
            checkLogin();
        } else {
            logoutUser();
        }
    } catch (error) {
        console.error("Session Check Error:", error);
    }
}
// ===========================================================================================================================
// ===========================================================================================================================
async function loginUser() {
    const identifier = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const msgElement = document.getElementById('login-msg');

    try {
        const response = await fetch(`${API_URL}/api/auth/local`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password }),
        });

        const data = await response.json();

        if (data.jwt) {
            localStorage.setItem('token', data.jwt);
            localStorage.setItem('user', JSON.stringify(data.user));

            // --- السطر المضاف هنا ---
            // نحفظ الـ ID بشكل مستقل ليسهل استدعاؤه في دوال Like و Comment
            localStorage.setItem('userId', data.user.id);
            // -----------------------

            msgElement.style.color = "blue";
            msgElement.innerText = `أهلاً بك يا ${data.user.username}!`;

            // تنظيف الحقول بعد النجاح
            document.getElementById('login-email').value = '';
            document.getElementById('login-password').value = '';

            checkLogin();
            fetchPosts(); // تحديث المنشورات فوراً لرؤية خيارات التفاعل
        } else {
            msgElement.style.color = "red";
            msgElement.innerText = "خطأ: " + (data.error?.message || "بيانات الدخول غير صحيحة");
        }
    } catch (error) {
        msgElement.innerText = "فشل الاتصال بالسيرفر.";
        console.error("Login Error:", error);
    }
}
// ===========================================================================================================================
// ===========================================================================================================================

function logout() {
    localStorage.clear(); // سيمسح كل شيء مرة واحدة
    checkLogin();
    fetchPosts();
}
// ===========================================================================================================================
// ===========================================================================================================================
async function showProfile() {
    const profileArea = document.getElementById('profile-area');
    if (profileArea) {
        profileArea.style.display = 'block';
        profileArea.scrollIntoView({ behavior: 'smooth' });
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/api/users/me?populate=*`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('prof-bio').innerText = data.bio || "لا توجد سيرة ذاتية.";
            document.getElementById('count-followers').innerText = data.followers ? data.followers.length : 0;
            document.getElementById('count-following').innerText = data.following ? data.following.length : 0;

            const usernameEl = document.getElementById('prof-username');
            if (data.avatar) {
                const imgUrl = getFullUrl(data.avatar.url);
                usernameEl.innerHTML = `
                    <img src="${imgUrl}" style="width:60px; height:60px; border-radius:50%; object-fit: cover; vertical-align: middle; margin-left: 10px; border: 2px solid #1877f2;"> 
                    ${data.username}`;
            } else {
                usernameEl.innerText = "👤 " + data.username;
            }
        }
    } catch (error) {
        console.error("Profile Fetch Error:", error);
    }
}
// ===========================================================================================================================
// ===========================================================================================================================
async function fetchPosts() {
    try {
        // 1. استخدام الرابط الأبسط لتجنب الـ 400 حالياً
        const response = await fetch(`${API_URL}/api/posts?populate=*&sort=createdAt:desc`);

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const result = await response.json();

        // 2. فحص الأمان: إذا لم تكن البيانات موجودة، توقف هنا ولا تكمل للـ forEach
        if (!result || !result.data) {
            console.error("No data found in response");
            return;
        }

        const posts = result.data;
        const feedElement = document.getElementById('feed');
        feedElement.innerHTML = '';

        posts.forEach(post => {
            const authorName = post.user?.username || "مستخدم مجهول";

            // 3. تأكد من طريقة جلب اللايكات (إذا لم تكن موجودة اجعلها 0)
            const likesCount = (post.likes && typeof post.likes === 'object' && post.likes.count)
                ? post.likes.count
                : (Array.isArray(post.likes) ? post.likes.length : 0);

            const imageUrl = post.image ? getFullUrl(post.image.url) : '';
            const postDocId = post.documentId;

            let commentsHTML = '<div class="comments-section">';
            const commentsData = post.comments || [];
            commentsData.forEach(comm => {
                const cUserName = comm.user?.username || "مستخدم";
                commentsHTML += `<p><strong>${cUserName}:</strong> ${comm.content}</p>`;
            });
            commentsHTML += '</div>';
            feedElement.innerHTML += `
                <div class="post-card">
                    <div class="post-header">
                        <span class="author">👤 ${authorName}</span>
                    </div>
                    <p class="post-content">${post.content}</p>
                    ${imageUrl ? `<img src="${imageUrl}" class="post-img">` : ''}
                    
                    <div class="post-actions">
                        <button class="like-btn" onclick="likePost('${postDocId}')">
                            ❤️ <span id="like-count-${postDocId}">${likesCount}</span>
                        </button>
                    </div>
                    ${commentsHTML}
                    <div class="add-comment">
                        <input type="text" id="comm-input-${postDocId}" placeholder="اكتب تعليقاً...">
                        <button onclick="addComment('${postDocId}')">إرسال</button>
                    </div>
                </div>`;
        });
    } catch (error) {
        console.error("Fetch Error:", error);
        const feedElement = document.getElementById('feed');
        if (feedElement) feedElement.innerHTML = '<p style="color:red; text-align:center;">حدث خطأ في جلب البيانات من السيرفر</p>';
    }
}
// ===========================================================================================================================
// ===========================================================================================================================
async function likePost(postDocId) {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');

    if (!token) return alert("يجب تسجيل الدخول للإعجاب");

    try {
        // 1. البحث هل يوجد لايك سابق من هذا المستخدم لهذا المنشور
        const checkRes = await fetch(`${API_URL}/api/likes?filters[user][id][$eq]=${userId}&filters[post][documentId][$eq]=${postDocId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const checkData = await checkRes.json();

        if (checkData.data && checkData.data.length > 0) {
            // 2. إذا وجد لايك، نقوم بحذفه (Unlike)
            const likeId = checkData.data[0].documentId;
            await fetch(`${API_URL}/api/likes/${likeId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log("تم إزالة الإعجاب");
        } else {
            // 3. إذا لم يجد لايك، نقوم بإضافته (Like)
            await fetch(`${API_URL}/api/likes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    data: { post: postDocId, user: userId }
                })
            });
            console.log("تم الإعجاب");
        }

        // تحديث الواجهة لرؤية الرقم الجديد
        fetchPosts();

    } catch (error) {
        console.error("Like Error:", error);
    }
}
// ===========================================================================================================================
// ===========================================================================================================================
async function addComment(postDocId) {
    const token = localStorage.getItem('token');
    const inputElement = document.getElementById(`comm-input-${postDocId}`);
    const content = inputElement.value.trim();

    if (!token) return alert("سجل دخولك أولاً للتعليق");
    if (!content) return alert("لا يمكنك إرسال تعليق فارغ");

    try {
        const response = await fetch(`${API_URL}/api/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                data: {
                    content: content,
                    post: postDocId, // نربط التعليق بالمنشور عبر الـ documentId
                    // ملاحظة: Strapi يربط المستخدم تلقائياً إذا كان الـ Token صحيحاً 
                    // ولكن لضمان الدقة يفضل إرسال الـ userId إذا كنت تخزنه
                    user: localStorage.getItem('userId')
                }
            })
        });

        if (response.ok) {
            inputElement.value = ''; // مسح الخانة بعد الإرسال
            fetchPosts(); // تحديث القائمة لإظهار التعليق الجديد
        } else {
            alert("فشل إرسال التعليق، تأكد من الصلاحيات");
        }
    } catch (error) {
        console.error("Comment Error:", error);
    }
}
// ===========================================================================================================================
// ===========================================================================================================================
async function createPost() {
    const content = document.getElementById('post-content').value;
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    const msgElement = document.getElementById('post-msg');

    if (!content) return;

    try {
        const response = await fetch(`${API_URL}/api/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                data: {
                    content: content,
                    // ربط المنشور بالمستخدم (جرب user.id مباشرة إذا لم يفلح الارتباط كمصفوفة)
                    user: user.id,
                    publishedAt: new Date().toISOString()
                }
            }),
        });

        const result = await response.json();

        if (response.ok) {
            msgElement.style.color = "green";
            msgElement.innerText = "تم النشر بنجاح!";
            document.getElementById('post-content').value = '';
            fetchPosts();
        } else {
            msgElement.style.color = "red";
            msgElement.innerText = "خطأ: " + result.error.message;
        }
    } catch (error) {
        console.error("Post Creation Error:", error);
    }
}
// ===========================================================================================================================
// ===========================================================================================================================
async function updateProfile() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    const newBio = document.getElementById('edit-bio').value;
    const avatarFile = document.getElementById('edit-avatar').files[0];

    if (!token) return alert("يجب تسجيل الدخول أولاً");

    try {
        let avatarId = null;

        // 1. رفع الصورة للسيرفر السحابي
        if (avatarFile) {
            const formData = new FormData();
            formData.append('files', avatarFile);

            const uploadRes = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                avatarId = uploadData[0].id;
            }
        }

        // 2. تحديث بيانات المستخدم
        const updateData = { bio: newBio };
        if (avatarId) updateData.avatar = avatarId;

        const response = await fetch(`${API_URL}/api/users/${user.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
        });

        if (response.ok) {
            const result = await response.json();
            localStorage.setItem('user', JSON.stringify(result));
            await showProfile(); // لتحديث الواجهة بالصور الجديدة
            alert("✅ تم تحديث بياناتك");
            document.getElementById('edit-avatar').value = "";
        }
    } catch (error) {
        console.error("Update Profile Error:", error);
    }
}

// ===========================================================================================================================
// ===========================================================================================================================

function hideProfile() {
    document.getElementById('profile-area').style.display = 'none';
}
// ===========================================================================================================================
// ===========================================================================================================================

// تشغيل الدوال عند البداية
checkUserSession();
checkLogin();
fetchPosts();