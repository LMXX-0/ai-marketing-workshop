<template>
  <!-- 应用外壳：固定顶部标题栏 + 页面内容区 -->
  <el-container>
    <el-header class="app-header">
      <span class="brand">AI 出海营销工坊</span>
      <nav class="nav">
        <router-link to="/assets">素材中心</router-link>
        <router-link to="/health">联调检测</router-link>
      </nav>
    </el-header>
    <el-main>
      <!-- 子页面渲染出口 -->
      <router-view />
    </el-main>
  </el-container>
</template>

<style>
/* 顶部标题栏样式 */
.app-header {
  display: flex;
  align-items: center;
  gap: 32px;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  background: #2c3e50;
}
.brand {
  font-size: 18px;
}
.nav {
  display: flex;
  gap: 20px;
  font-size: 14px;
  font-weight: 400;
}
.nav a {
  color: rgba(255, 255, 255, 0.75);
  text-decoration: none;
}
.nav a:hover,
.nav a.router-link-active {
  color: #fff;
}
</style>
