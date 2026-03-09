# API Request Body Samples

Tài liệu này cung cấp các mẫu JSON request body cho từng endpoint API để phục vụ việc kiểm thử (Postman, Swagger, etc.).

## 1. Auth Module

### Đăng ký (Register)

`POST /auth/register`

```json
{
  "email": "testuser@example.com",
  "username": "testuser",
  "password": "Password123!",
  "confirmPassword": "Password123!",
  "displayName": "Người Dùng Thử"
}
```

### Đăng nhập (Login)

`POST /auth/login`

```json
{
  "email": "testuser@example.com",
  "password": "Password123!"
}
```

---

## 2. Story Module

### Tạo truyện (Create Story)

`POST /stories`

```json
{
  "title": "Hành Trình Huyền Thoại",
  "slug": "hanh-trinh-huyen-thoai",
  "description": "Một câu chuyện sử thi về lòng dũng cảm và phép thuật.",
  "coverImage": "https://example.com/cover.jpg",
  "type": "NOVEL",
  "status": "ONGOING",
  "genreIds": ["uuid-the-loai-1", "uuid-the-loai-2"],
  "tagIds": ["uuid-tag-1"],
  "isPublished": true
}
```

### Cập nhật truyện (Update Story)

`PUT /stories/:id`

```json
{
  "title": "Hành Trình Huyền Thoại (Bản chỉnh sửa)",
  "status": "COMPLETED"
}
```

---

## 3. Chapter Module

### Tạo chương mới (Create Chapter)

`POST /stories/:storyId/chapters`

```json
{
  "title": "Chương 1: Khởi đầu mới",
  "slug": "chuong-1-khoi-dau-moi",
  "chapterNumber": 1,
  "content": "Nội dung chương truyện ở đây...",
  "isPublished": true,
  "isPremium": false,
  "price": 0,
  "wordCount": 1500
}
```

### Cập nhật chương (Update Chapter)

`PUT /stories/:storyId/chapters/:chapterNumber`

```json
{
  "title": "Chương 1: Bình minh rạng rỡ",
  "content": "Nội dung chương truyện đã được chỉnh sửa...",
  "isPublished": true
}
```

---

## 4. Comment Module

### Tạo bình luận (Create Comment)

`POST /stories/:storyId/comments`

```json
{
  "content": "Truyện hay quá! Hóng chương tiếp theo.",
  "parentId": null
}
```

### Trả lời bình luận (Reply to Comment)

`POST /stories/:storyId/comments`

```json
{
  "content": "Mình cũng thấy vậy, tác giả viết chắc tay thật.",
  "parentId": "uuid-cua-comment-cha"
}
```

---

## 5. Bookmark & Follow (Không cần Body)

Các API này sử dụng thông tin từ URL và Token (userId lấy từ token):

- **Bookmark**: `POST /bookmarks/:storyId`
- **Unbookmark**: `DELETE /bookmarks/:storyId`
- **Follow**: `POST /follow/:userId`
- **Unfollow**: `DELETE /follow/:userId`
