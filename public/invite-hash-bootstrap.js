(() => {
  const search = window.location.search || "";
  const hash = window.location.hash || "";
  window.location.replace(`/auth/invite-continue${search}${hash}`);
})();
