/** Plain note shape. No I/O. */

export function createNote({
  id = "",
  title = "",
  date = "",
  tags = [],
  body = "",
  path = null,
} = {}) {
  return {
    id,
    title,
    date,
    tags: [...tags],
    body,
    path,
  };
}
