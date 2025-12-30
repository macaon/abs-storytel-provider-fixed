const axios = require('axios');
const NodeCache = require('node-cache');

const cache = new NodeCache({
    stdTTL: 600
});

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
];

let userAgentIndex = 0;

class StorytelProvider {
    constructor() {
        this.baseSearchUrl = 'https://www.storytel.com/api/search.action';
        this.baseBookUrl = 'https://www.storytel.com/api/getBookInfoForContent.action';
        this.locale = 'en';
    }

    setLocale(locale) {
        this.locale = locale;
    }

    getNextUserAgent() {
        const ua = USER_AGENTS[userAgentIndex];
        userAgentIndex = (userAgentIndex + 1) % USER_AGENTS.length;
        return ua;
    }

    createFreshAxios(userAgent) {
        return axios.create({
            headers: {
                'User-Agent': userAgent,
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br'
            },
            timeout: 30000
        });
    }

    ensureString(value) {
        if (value === null || value === undefined) return '';
        return String(value).trim();
    }

    upgradeCoverUrl(url) {
        if (!url) return undefined;
        return `https://storytel.com${url.replace('320x320', '640x640')}`;
    }

    splitGenre(genre) {
        if (!genre) return [];
        return genre.split(/[\/,]/).map(g => {
            const trimmedGenre = g.trim();
            return trimmedGenre === 'Sci-Fi' ? 'Science-Fiction' : trimmedGenre;
        });
    }

    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    formatBookMetadata(bookData) {
        const slb = bookData.slb;
        if (!slb || !slb.book) return null;

        const book = slb.book;
        const abook = slb.abook;
        const ebook = slb.ebook;

        if (!abook && !ebook) return null;

        let seriesInfo = null;
        let seriesName = null;
        if (book.series && book.series.length > 0 && book.seriesOrder) {
            seriesName = book.series[0].name;
            seriesInfo = [{
                series: this.ensureString(seriesName),
                sequence: this.ensureString(book.seriesOrder)
            }];
        }

        const author = this.ensureString(book.authorsAsString);
        let title = book.name;
        let subtitle = null;

        const patterns = [
            /^.*?,\s*Aflevering\s*\d+:\s*/i, /^.*?,\s*Deel\s*\d+:\s*/i,
            /^.*?,\s*Episódio\s*\d+:\s*/i, /^.*?,\s*Parte\s*\d+:\s*/i,
            /^.*?,\s*епизод\s*\d+:\s*/i, /^.*?,\s*том\s*\d+:\s*/i,
            /^.*?,\s*част\s*\d+:\s*/i, /^.*?,\s*Episodio\s*\d+:\s*/i,
            /^.*?,\s*Volumen\s*\d+:\s*/i, /^.*?,\s*Afsnit\s*\d+:\s*/i,
            /^.*?,\s*Bind\s*\d+:\s*/i, /^.*?,\s*Del\s*\d+:\s*/i,
            /^.*?,\s*حلقة\s*\d+:\s*/i, /^.*?,\s*مجلد\s*\d+:\s*/i,
            /^.*?,\s*جزء\s*\d+:\s*/i, /^.*?,\s*Jakso\s*\d+:\s*/i,
            /^.*?,\s*Volyymi\s*\d+:\s*/i, /^.*?,\s*Osa\s*\d+:\s*/i,
            /^.*?,\s*Épisode\s*\d+:\s*/i, /^.*?,\s*Tome\s*\d+:\s*/i,
            /^.*?,\s*Partie\s*\d+:\s*/i, /^.*?,\s*Episode\s*\d+:\s*/i,
            /^.*?,\s*Bagian\s*\d+:\s*/i, /^.*?,\s*פרק\s*\d+:\s*/i,
            /^.*?,\s*כרך\s*\d+:\s*/i, /^.*?,\s*חלק\s*\d+:\s*/i,
            /^.*?,\s*कड़ी\s*\d+:\s*/i, /^.*?,\s*खण्ड\s*\d+:\s*/i,
            /^.*?,\s*भाग\s*\d+:\s*/i, /^.*?,\s*Þáttur\s*\d+:\s*/i,
            /^.*?,\s*Bindi\s*\d+:\s*/i, /^.*?,\s*Hluti\s*\d+:\s*/i,
            /^.*?,\s*Odcinek\s*\d+:\s*/i, /^.*?,\s*Tom\s*\d+:\s*/i,
            /^.*?,\s*Część\s*\d+:\s*/i, /^.*?,\s*Avsnitt\s*\d+:\s*/i,
            /^.*?,\s*Folge\s*\d+:\s*/i, /^.*?,\s*Band\s*\d+:\s*/i,
            /^.*?\s+-\s+\d+:\s*/i, /^.*?\s+\d+:\s*/i,
            /^.*?,\s*Teil\s*\d+:\s*/i, /^.*?,\s*Volume\s*\d+:\s*/i,
            /\s*\((Ungekürzt|Gekürzt)\)\s*$/i, /,\s*Teil\s+\d+$/i,
            /-\s*.*?(?:Reihe|Serie)\s+\d+$/i
        ];

        patterns.forEach(pattern => title = title.replace(pattern, ''));

        if (seriesInfo) {
            subtitle = `${seriesName} ${book.seriesOrder}`;
            if (title.includes(seriesName)) {
                const safeSeriesName = this.escapeRegex(seriesName);
                const regex = new RegExp(`^(.+?)[-,]\\s*${safeSeriesName}`, 'i');
                const beforeSeriesMatch = title.match(regex);
                if (beforeSeriesMatch) title = beforeSeriesMatch[1].trim();
                title = title.replace(seriesName, '');
            }
        }

        if (title.includes(':') || title.includes('-')) {
            const parts = title.split(/[:\-]/);
            if (parts[1] && parts[1].trim().length >= 3) {
                title = parts[0].trim();
                subtitle = parts[1].trim();
            }
        }

        patterns.forEach(pattern => title = title.replace(pattern, ''));
        title = title.trim();
        if (subtitle) subtitle = subtitle.trim();

        const genres = book.category ? this.splitGenre(this.ensureString(book.category.title)) : [];

        const metadata = {
            title: this.ensureString(title),
            subtitle: subtitle,
            author: author,
            language: this.ensureString(book.language?.isoValue || this.locale),
            genres: genres.length > 0 ? genres : undefined,
            series: seriesInfo,
            cover: this.upgradeCoverUrl(book.largeCover),
            duration: abook ? (abook.length ? Math.floor(abook.length / 60000) : undefined) : undefined,
            narrator: abook ? abook.narratorAsString || undefined : undefined,
            description: this.ensureString(abook ? abook.description : ebook?.description),
            publisher: this.ensureString(abook ? abook.publisher?.name : ebook?.publisher?.name),
            publishedYear: (abook ? abook.releaseDateFormat : ebook?.releaseDateFormat)?.substring(0, 4),
            isbn: this.ensureString(abook ? abook.isbn : ebook?.isbn)
        };

        Object.keys(metadata).forEach(key => metadata[key] === undefined && delete metadata[key]);
        return metadata;
    }

    async searchBooks(query, author = '', locale) {
        const cleanQuery = query.split(':')[0].trim();
        const formattedQuery = cleanQuery.replace(/\s+/g, '+');
        const cacheKey = `${formattedQuery}-${author}-${locale}`;

        const cachedResult = cache.get(cacheKey);
        if (cachedResult) {
            return cachedResult;
        }

        const sessionUserAgent = this.getNextUserAgent();

        try {
            const searchAxios = this.createFreshAxios(sessionUserAgent);
            const searchResponse = await searchAxios.get(this.baseSearchUrl, {
                params: {
                    request_locale: locale,
                    q: formattedQuery
                }
            });

            if (!searchResponse.data || !searchResponse.data.books) {
                return { matches: [] };
            }

            const books = searchResponse.data.books.slice(0, 5);
            console.log(`Found ${books.length} books in search results`);

            const matches = [];
            
            for (let i = 0; i < books.length; i++) {
                const book = books[i];
                if (!book.book || !book.book.id) continue;
                
                // Small delay between detail requests to be polite
                if (i > 0) {
                    await delay(1000);
                }
                
                const bookDetails = await this.getBookDetails(book.book.id, locale, sessionUserAgent);
                
                if (bookDetails) {
                    const formatted = this.formatBookMetadata(bookDetails);
                    if (formatted) {
                        matches.push(formatted);
                    }
                }
            }

            console.log(`Successfully fetched ${matches.length} books`);
            const result = { matches };
            cache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.error('Error searching books:', error.message);
            return { matches: [] };
        }
    }
    
    async getBookDetails(bookId, locale, userAgent) {
        try {
            const detailAxios = this.createFreshAxios(userAgent);
            
            const response = await detailAxios.get(this.baseBookUrl, {
                params: {
                    bookId: bookId,
                    request_locale: locale
                }
            });
            
            return response.data;
        } catch (error) {
            console.error(`Error fetching book details for ID ${bookId}:`, error.message);
            return null;
        }
    }
}

module.exports = StorytelProvider;
