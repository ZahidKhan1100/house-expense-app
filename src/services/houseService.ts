import { apiClient } from "../utils/apiClient";

export const getDashboardData = async () => {
  return apiClient("/dashboard", "GET");
};