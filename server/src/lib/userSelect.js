const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

const USER_PUBLIC_INCLUDE = {
  select: USER_PUBLIC_SELECT,
};

module.exports = {
  USER_PUBLIC_SELECT,
  USER_PUBLIC_INCLUDE,
};
