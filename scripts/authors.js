const PROVIDERS = {
  'github.com': {
    apiUrl: (owner) => `https://api.github.com/users/${owner}`,
    useAuthHeaders: true,
    normalize: (data) => ({ image: data.avatar_url, name: data.name }),
  },
  'gitlab.com': {
    apiUrl: (owner) => `https://gitlab.com/api/v4/users?username=${owner}`,
    useAuthHeaders: false,
    normalize: (data) => {
      const user = Array.isArray(data) ? data[0] : data;
      return { image: user?.avatar_url, name: user?.name };
    },
  },
  'codeberg.org': {
    apiUrl: (owner) => `https://codeberg.org/api/v1/users/${owner}`,
    useAuthHeaders: false,
    normalize: (data) => ({ image: data.avatar_url, name: data.full_name || data.login }),
  },
};

const getProvider = (byUrl) => {
  const { hostname, pathname } = new URL(byUrl);
  const provider = PROVIDERS[hostname];
  if (!provider) {
    throw new Error(`Unsupported author provider: ${hostname} (${byUrl})`);
  }
  // strip leading and trailing slashes from the URL path to get the bare owner
  const owner = pathname.replace(/^\/+|\/+$/g, '');
  return { host: hostname, owner, ...provider };
};

export const createAuthorResolver = ({ cache, headers }) => {
  let dirty = false;

  const resolve = async (byUrl) => {
    const { host, owner, apiUrl, useAuthHeaders, normalize } = getProvider(byUrl);

    if (!cache.hasOwnProperty(owner)) {
      console.log(`fetching author ${owner} from ${host}`);
      const response = await fetch(apiUrl(owner), {
        headers: useAuthHeaders ? headers : {},
      }).then((res) => res.json());
      cache[owner] = response;
      dirty = true;
    }

    return {
      ...normalize(cache[owner]),
      url: byUrl,
    };
  };

  return {
    resolve,
    isDirty: () => dirty,
  };
};
