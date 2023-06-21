let pagesIndex, allModules, modules, tags, query, searchParts = {tags: [], query: ""},
    pagination = {perPage: 10, page: 1, total: 0, maxPage: 0};

const sortOptions = {
    alphabetic: 'alphabetically',
    relevance: 'relevance',
    mostDownloads: 'most-downloads',
    mostRecent: 'most-recent'
};

let sort = sortOptions.alphabetic;


// if sorting is selected from the dropdown then do not change it automatically
const changeDefaultSorting = newSortOption => (getSearchParam('sort') == null) && (sort = newSortOption)

const resultsWrapper = document.querySelector('div.modules-list');
const searchfor = document.getElementById('searchfor');
document.addEventListener('QUERY_CHANGED', () => {
    if (query & query.length > 0) {
        searchfor.style.display = 'block';
        searchfor.querySelector('b').innerText = query;
        changeDefaultSorting(sortOptions.relevance);
    } else {
        searchfor.style.display = 'none';
    }
})

let flexSearchIndex = new FlexSearch.Document({
    document: {
        id: 'id',
        index: ['title', 'description']
    },
    charset: "latin",
    tokenize: "full",
    matcher: "simple",
    cache: true
});

fetch('/js/lunr/PagesIndex.json')
    .then(response => response.json())
    .then(index => {
        pagesIndex = index;

        for (const id in index) {
            const page = index[id];
            flexSearchIndex.add({
                id: page.id,
                description: page.description,
                title: page.title
            })
        }

        allModules = modules = modulesList('');
        document.dispatchEvent(new Event('RENDER'))
        document.dispatchEvent(new Event('modules_loaded'))
    });

document.addEventListener('modules_loaded', function (e) {
    tags = [];
    allModules.forEach(module => {
        tags.push(...module.tags)
    })
    tags = new Set(tags);
    document.dispatchEvent(new Event('TAGS_LOADED'))
})

const getSearchParam = name => sanitizeString((new URLSearchParams(location.search)).get(name));

const sortBy = document.querySelector('.sort-by');
const orderChanged = (e) => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('sort', e.target.dataset.value);
    location.search = searchParams.toString();
}

document.querySelectorAll('.sort-by .dropdown-select_options div').forEach(item => item.addEventListener('click', orderChanged))

document.addEventListener('TAGS_LOADED', function (e) {
    const selectedTags = getTags();
    let tagsHtml = '';
    tags.forEach(tag => tagsHtml += tag == 'Supported' ? '' : `<li><a onclick="selectTag('${sanitizeString(tag)}')" href="#">${sanitizeString(tag)}</a></li>`);
    document.querySelector('ul.tags').innerHTML = tagsHtml;
    if (selectedTags.length) {
        document.querySelector('.modules-applied-tags').style.display = 'block';
        searchParts.tags.push(...selectedTags);
        document.dispatchEvent(new Event('RENDER'))
        document.querySelector('.modules-applied-tags ul').innerHTML = selectedTags.map(item => `<li>${sanitizeString(item)} <a onclick="removeTag('${sanitizeString(item)}')" href="#"><i class="bi bi-x"></i></a></li>`).join('');
    } else {
        document.querySelector('.modules-applied-tags').style.display = 'none';
    }
})

let renderTimeout;
document.addEventListener('RENDER', function () {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => {
        renderModules(paginate(sorting(modulesList(searchParts.query, searchParts.tags)), pagination.perPage, pagination.page));
    }, 200);
})

document.querySelector('input[name="query"]').onkeyup = (e) => {
    searchParts.query = e.target.value;
    query = e.target.value;
    const url = new URL(window.location);
    url.searchParams.set('query', e.target.value);
    window.history.pushState({}, '', url);
    changeDefaultSorting((query.length > 0 ? sortOptions.relevance : sortOptions.alphabetic));
    document.dispatchEvent(new Event('RENDER'));
    document.dispatchEvent(new Event('QUERY_CHANGED'));
}

document.addEventListener("modules_loaded", () => {
    if (getSearchParam('query')) {
        document.querySelector('input[name="query"]').value = getSearchParam('query');
        searchParts.query = getSearchParam('query').trim();
        query = getSearchParam('query').trim();
        document.dispatchEvent(new Event('RENDER'));
        document.dispatchEvent(new Event('QUERY_CHANGED'));
    }

    if (getSearchParam('page')) {
        pagination.page = parseInt(getSearchParam('page'));
        document.dispatchEvent(new Event('RENDER'))
    }

    if (getSearchParam('perPage')) {
        pagination.perPage = parseInt(getSearchParam('perPage'));
        document.dispatchEvent(new Event('RENDER'))
    }

    if (getSearchParam('sort') && Object.values(sortOptions).includes(getSearchParam('sort'))) {
        sort = getSearchParam('sort');
        document.dispatchEvent(new Event('RENDER'))
    }
});


const selectTag = function (tag) {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('page', '1');
    let tags = new Set(searchParams.getAll('tag').map(item => item.toLowerCase()));
    tags.add(tag);
    searchParams.delete('tag')
    tags.forEach(item => searchParams.append('tag', item))
    location.search = searchParams.toString();
}

const removeTag = function (tag) {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('page', '1');
    let tags = new Set(searchParams.getAll('tag').map(item => item.toLowerCase()));
    tags.delete(tag);
    searchParams.delete('tag')
    tags.forEach(item => searchParams.append('tag', item))
    location.search = searchParams.toString();
}

const removeAllTags = function () {
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('tag')
    location.search = searchParams.toString();
}

const getTags = () => (new URLSearchParams(location.search)).getAll('tag');


const modulesList = function (query, tags = []) {
    let ids = [];
    modules = [];
    if (query.length > 0) {
        flexSearchIndex.search(query).forEach(item => ids.push(...item.result));
        [...new Set(ids)].map(key => {
           modules.push(pagesIndex[key])
        });
    } else {
        modules = Object.keys(pagesIndex).map(key => pagesIndex[key]);
    }

    if (tags.length > 0) {
        // if we merge module tags and tags from the filter and unique array length will be the same as module tags length,
        // then all filtered tags intersect with module tags
        modules = modules.filter(item =>  [...new Set([...item.tags, ...tags])].length == (item.tags.length ))
    }
    return modules;
}

function renderModules(results) {
    pagination.maxPage = Math.ceil(modules.length / pagination.perPage);
    resultsWrapper.innerHTML = '';
    document.querySelectorAll('.pagesCount').forEach(item => item.innerHTML = modules.length);
    initPaginationHtml();
    if (!results.length || !resultsWrapper) {
        return;
    }

    resultsWrapper.innerHTML = '';
    let modulesHTML = '';
    results.forEach(function (result) {
        modulesHTML += `
            <article class="modules-item">
   <div class="flex flex-space-between">
      <div>
         <div class="modules-item_name flex-grow">
            <div class="flex flex--align_center">
               <div class="modules-item_avatar">
                  <img width="32" height="32" src="${result.author.image}">
               </div>
               <div>
                  <a href="${result.href}" class="modules-item_title">${result.title}</a>
                  <div class="modules-item_author">by ${result.author.name}</div>
               </div>
            </div>
         </div>
         <p class="modules-item_description">
            ${result.description}
         </p>
         <div class="modules-item_tags tags">
          <ul>
              ${result.tags.map(tag => ` <li class="${tag.toLowerCase()}">
                <a onclick="selectTag('${tag}')" href="#">${tag}</a>
             </li>`).join('')}
          </ul>
        </div>
      </div>
      <div class="right-info">
         <div>${result.version ? 'Version: ' + result.version : ''}</div>
         <div>Updated: ${result.updated}</div>
         <div>Total downloads: ${result.downloads}</div>
      </div>
   </div>
</article>`
    });
    resultsWrapper.innerHTML = modulesHTML;
}

const paginate = (items, perPage, page) => items.slice((page - 1) * perPage, page * perPage);
const sorting = (items) => {
    switch (sort) {
        case sortOptions.alphabetic:
            items = items.sort((a, b) => a.title.localeCompare(b.title))
            break;
        case sortOptions.mostDownloads:
            items = items.sort((a, b) => b.downloads - a.downloads)
            break;
        case sortOptions.mostRecent:
            items = items.sort((a, b) => (new Date(b.updated)).getTime() - (new Date(a.updated)).getTime())
            break;
        default:
            break;
    }
    return items;
}

const perPageDropdown = document.querySelector('.perPage');
if (perPageDropdown) {
    perPageDropdown.querySelectorAll('.dropdown-select_options > div').forEach(item => item.addEventListener('click', e => {
        pagination.perPage = parseInt(e.target.dataset.value);
        pagination.page = 1;
        perPageDropdown.querySelector('span > div').innerText = e.target.dataset.value;
        document.dispatchEvent(new Event('paginated'));
    }))
}

const next_page = document.getElementById('next_page');
next_page.addEventListener('click', () => {
    if (next_page.classList.contains('disabled')) return;
    pagination.page = pagination.page >= pagination.maxPage ? pagination.maxPage : pagination.page + 1;
    document.dispatchEvent(new Event('paginated'))
})

const prev_page = document.getElementById('prev_page');
prev_page.addEventListener('click', () => {
    if (prev_page.classList.contains('disabled')) return;
    pagination.page = pagination.page <= 1 ? 1 : pagination.page - 1;
    document.dispatchEvent(new Event('paginated'))
})

const last_page = document.getElementById('last_page');
last_page.addEventListener('click', () => {
    if (last_page.classList.contains('disabled')) return;
    pagination.page = pagination.maxPage;
    document.dispatchEvent(new Event('paginated'))
})

const first_page = document.getElementById('first_page');
first_page.addEventListener('click', () => {
    if (first_page.classList.contains('disabled')) return;
    pagination.page = 1;
    document.dispatchEvent(new Event('paginated'))
})

document.addEventListener('paginated', () => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('page', pagination.page)
    searchParams.set('perPage', pagination.perPage)
    location.search = searchParams.toString();
})

const initPaginationHtml = () => {
    if (pagination.page == pagination.maxPage) {
        last_page.classList.add('disabled');
        next_page.classList.add('disabled');
    } else {
        last_page.classList.remove('disabled');
        next_page.classList.remove('disabled');
    }

    if (pagination.page == 1) {
        first_page.classList.add('disabled');
        prev_page.classList.add('disabled');
    } else {
        first_page.classList.remove('disabled');
        prev_page.classList.remove('disabled');
    }

    pagination.total = modules.length;
    let endPage = pagination.page * pagination.perPage;
    endPage = endPage > pagination.total ? pagination.total : endPage;
    document.getElementById('startPage').innerText = ((pagination.page - 1) * pagination.perPage + 1).toString();
    document.getElementById('endPage').innerText = endPage.toString();

    if (sort) {
        sortBy.querySelector('span > div').innerText = sort.capitalize().replace('-', ' ');
    }

    perPageDropdown.querySelector('span > div').innerHTML = pagination.perPage;
}
