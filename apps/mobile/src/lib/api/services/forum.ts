import { API_ROUTES, forumRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

export const forumService = {
  getPosts: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get(forumRoutes.posts(), { params }),
  getPostById: (id: string) => apiClient.get(forumRoutes.post(id)),
  createPost: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post(forumRoutes.posts(), data),
  updatePost: (id: string, data: Record<string, string | number | boolean | undefined>) =>
    apiClient.put(forumRoutes.post(id), data),
  deletePost: (id: string) => apiClient.delete(forumRoutes.post(id)),
  likePost: (id: string) => apiClient.post(forumRoutes.postLike(id)),
  unlikePost: (id: string) => apiClient.delete(forumRoutes.postLike(id)),
  getComments: (postId: string) => apiClient.get(forumRoutes.comments(postId)),
  createComment: (postId: string, data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post(forumRoutes.comments(postId), data),
  deleteComment: (postId: string, commentId: string) =>
    apiClient.delete(`${API_ROUTES.FORUMS}/posts/${postId}/comments/${commentId}`),
  getCategories: () => apiClient.get(`${API_ROUTES.FORUMS}/categories`),
  reportPost: (id: string, reason: string) =>
    apiClient.post(forumRoutes.postReport(id), { reason }),
  getStats: () => apiClient.get(`${API_ROUTES.FORUMS}/stats`),
};
