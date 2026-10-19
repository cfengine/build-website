# CFEngine Build website

The website lists available modules from the index and gives you easy commands to copy.

## Deployment workflow

1. Create your own branch / fork based on master branch.
2. Make changes locally and preview with docker / hugo.
3. Submit a PR to `cfengine:master` - once reviewed and merged see results here: https://staging.build.cfengine.com/
4. Create a new PR from `cfengine:master` to `cfengine:production` here: https://github.com/cfengine/build-website/compare/production...master
5. Merge to deploy (after seeing it working on staging site).


## Dependencies

[Hugo](https://gohugo.io/).
[Lunr](https://lunrjs.com/).
[Node.js](https://nodejs.dev/).
[Go](https://go.dev/) (needed by Hugo to download modules).


## Build

```
export GITHUB_USERNAME_TOKEN='place githubName:token here'
npm ci
npm run build
npm run create-modules-json
hugo
```

## Serve

```
cd public
python3 -m http.server

or

hugo serve
```

## Container

Using docker / podman to build and serve is fairly straight forward:

```
export GITHUB_USERNAME_TOKEN='place githubName:token here'
docker build --build-arg GITHUB_USERNAME_TOKEN --tag cfengine-build-website -f Dockerfile . && docker run -it -p 80:80 -p 81:81 --volume ./proxy:/home/proxy --name cfengine-build-website --rm cfengine-build-website
```

## CFEngine Build repositories

* [build-index](https://github.com/cfengine/build-index) - Index of modules
* [build-website](https://github.com/cfengine/build-website) - Website
* [cfbs](https://github.com/cfengine/cfbs) - Command line client
* [modules](https://github.com/cfengine/modules) - Official modules provided by the CFEngine team
* [module-template](https://github.com/cfengine/build-example) - Template for creating new modules
