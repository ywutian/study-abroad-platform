import { apiClient } from '../client';

export const forumService = {
  getPosts: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get('/forum/posts', { params }),
  getPostById: (id: string) => apiClient.get(`/forum/posts/${id}`),
  createPost: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post('/forum/posts', data),
  updatePost: (id: string, data: Record<string, string | number | boolean | undefined>) =>
    apiClient.put(`/forum/posts/${id}`, data),
  deletePost: (id: string) => apiClient.delete(`/forum/posts/${id}`),
  likePost: (id: string) => apiClient.post(`/forum/posts/${id}/like`),
  unlikePost: (id: string) => apiClient.delete(`/forum/posts/${id}/like`),
  getComments: (postId: string) => apiClient.get(`/forum/posts/${postId}/comments`),
  createComment: (postId: string, data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post(`/forum/posts/${postId}/comments`, data),
  deleteComment: (postId: string, commentId: string) =>
    apiClient.delete(`/forum/posts/${postId}/comments/${commentId}`),
  getCategories: () => apiClient.get('/forum/categories'),
  reportPost: (id: string, reason: string) =>
    apiClient.post(`/forum/posts/${id}/report`, { reason }),
  getStats: () => apiClient.get('/forum/stats'),
};
