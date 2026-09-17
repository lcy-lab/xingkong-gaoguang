import { createRouter, createWebHistory } from "vue-router";
import { isLoggedIn } from "../stores/auth";
import { isUserLoggedIn } from "../stores/user";
import HomeView from "../views/HomeView.vue";
import MediaView from "../views/MediaView.vue";
import SubmitView from "../views/SubmitView.vue";
import LoginView from "../views/LoginView.vue";
import RegisterView from "../views/RegisterView.vue";
import AdminLoginView from "../views/AdminLoginView.vue";
import AdminDashboardView from "../views/AdminDashboardView.vue";
import NotFoundView from "../views/NotFoundView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView, meta: { title: "首页" } },
    {
      path: "/games/:slug/videos",
      name: "videos",
      component: MediaView,
      props: { kind: "video" },
    },
    {
      path: "/games/:slug/screenshots",
      name: "screenshots",
      component: MediaView,
      props: { kind: "screenshot" },
    },
    {
      path: "/submit",
      name: "submit",
      component: SubmitView,
      meta: { title: "投稿", requiresUser: true },
    },
    { path: "/login", name: "login", component: LoginView, meta: { title: "登录" } },
    { path: "/register", name: "register", component: RegisterView, meta: { title: "注册" } },
    { path: "/admin/login", name: "admin-login", component: AdminLoginView, meta: { title: "管理员登录" } },
    {
      path: "/admin",
      name: "admin",
      component: AdminDashboardView,
      meta: { title: "管理后台", requiresAuth: true },
    },
    { path: "/:pathMatch(.*)*", name: "not-found", component: NotFoundView, meta: { title: "未找到" } },
  ],
});

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !isLoggedIn()) {
    return { name: "admin-login" };
  }
  if (to.name === "admin-login" && isLoggedIn()) {
    return { name: "admin" };
  }
  if (to.meta.requiresUser && !isUserLoggedIn()) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if ((to.name === "login" || to.name === "register") && isUserLoggedIn()) {
    return { name: "home" };
  }
  document.title = `${to.meta.title || "星穹高光"} · 星穹高光`;
  return true;
});

export default router;
