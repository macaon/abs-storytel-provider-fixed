# Storytel Provider for Audiobookshelf (Fixed)

A metadata provider that fetches book information from Storytel's API for use with [Audiobookshelf](https://www.audiobookshelf.org/).

This is a **fixed fork** of [Revisor01/abs-storytel-provider](https://github.com/Revisor01/abs-storytel-provider) that resolves 403 Forbidden errors caused by Storytel's anti-scraping measures.

## What's Fixed?

The original provider would work for one search after container startup, then fail with 403 errors on subsequent searches. This version implements **User-Agent rotation** to appear as different browsers, allowing continuous operation without restarts.

### Technical Details

Storytel's API tracks browser sessions and blocks repeated requests from the same User-Agent. By rotating through a pool of realistic browser User-Agent strings for each search, this version avoids triggering rate limits while maintaining respectful request patterns.

## Features

* ✅ **Continuous operation** - No more container restarts needed
* ✅ High-resolution cover images (640x640)
* ✅ Smart title and series handling
* ✅ Multi-region support
* ✅ Separate audiobook and book endpoints
* ✅ Audiobook-specific metadata (duration, narrator, etc.)

## Installation

### Building from Source
```bash
git clone https://github.com/macaon/abs-storytel-provider-fixed.git
cd abs-storytel-provider-fixed
docker build -t abs-storytel-provider-fixed .
docker run -d --name abs-storytel-provider --network abs_network abs-storytel-provider-fixed
```

### docker-compose
```services:
  abs-storytel-provider:
    image: abs-storytel-provider-fixed:latest
    container_name: abs-storytel-provider
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true


## Configuration in Audiobookshelf

1. Go to **Settings** → **Metadata** in Audiobookshelf
2. Click **Add Custom Provider**
3. Choose one of the following endpoints:

### Endpoints

* **All media**: `http://abs-storytel-provider:3000/<region>`
  * Example: `http://abs-storytel-provider:3000/se`
* **Books only**: `http://abs-storytel-provider:3000/<region>/book`
* **Audiobooks only**: `http://abs-storytel-provider:3000/<region>/audiobook`

### Supported Regions

The provider supports different Storytel regions by changing the region code in the URL:

* 🇸🇪 Swedish: `/se`
* 🇩🇪 German: `/de`
* 🇬🇧 English: `/en`
* 🇳🇴 Norwegian: `/no`
* 🇩🇰 Danish: `/dk`
* 🇫🇮 Finnish: `/fi`
* And more...

## Authentication (Optional)

To prevent unauthorized access, set the `AUTH` environment variable:
```yaml
services:
  abs-storytel-provider:
    environment:
      - AUTH=your-secret-key
```

Then include the `Authorization` header in your Audiobookshelf provider configuration with the value of your secret key.

## How It Works

### User-Agent Rotation

The provider maintains a pool of 8 realistic browser User-Agent strings:
- Chrome on Windows
- Chrome on macOS
- Firefox on Windows
- Safari on macOS
- Chrome on Linux
- Edge on Windows
- Firefox on Linux

Each search request uses a different User-Agent from this pool, rotating through them sequentially. This makes each search appear to come from a different browser/device, bypassing Storytel's session-based rate limiting.

### Request Flow

1. Search request arrives from Audiobookshelf
2. Provider selects next User-Agent from pool
3. Searches Storytel API with that User-Agent
4. Fetches details for each book using the same User-Agent
5. Small delays (1s) between detail requests to be respectful
6. Returns formatted metadata to Audiobookshelf
7. Results cached for 10 minutes

## Metadata Processing

### Title Handling
* Removes format indicators (Unabridged, Abridged, etc.)
* Cleans series information from titles
* Extracts subtitles
* Handles series formats in 25+ languages

### Series Information
* Formatted as "Series Name, Number"
* Maintains clean titles without series markers

### Audiobook-Specific Metadata
* Duration in minutes
* Narrator information
* Publisher details
* Release year
* ISBN

## Known Limitations

* Search results depend on Storytel API availability
* Some metadata fields might be unavailable depending on the book
* Maximum of 5 results per search
* Results are cached for 10 minutes

## Troubleshooting

### Still getting 403 errors?
- Make sure you're using the fixed version
- Check container logs: `docker logs abs-storytel-provider`
- Verify the container is running: `docker ps`
- Ensure network connectivity between containers

### No results returned?
- Verify the region code is correct
- Check that the book exists in that Storytel region
- Try searching with just the author or title

### Slow responses?
- This is normal - the provider adds small delays to avoid triggering rate limits
- First request may be slower (not cached)
- Subsequent identical searches are cached for 10 minutes

## Development

### Requirements
- Node.js 18+
- Docker (for containerized deployment)

### Local Development
```bash
npm install
npm start
```

The provider will listen on port 3000.

### Testing
```bash
# Test search endpoint
curl "http://localhost:3000/se/search?query=Harry+Potter"

# Test audiobook endpoint
curl "http://localhost:3000/se/audiobook/search?query=Harry+Potter"
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Credits

* Original project by [Revisor01](https://github.com/Revisor01/abs-storytel-provider)
* User-Agent rotation fix by [YOUR-NAME]
* Built for [Audiobookshelf](https://www.audiobookshelf.org/)

## License

MIT License - See [LICENSE](LICENSE) file for details

## Disclaimer

This is an unofficial third-party provider. It accesses Storytel's public API for metadata only and does not provide access to Storytel's content. You must have a valid Storytel subscription to access their audiobooks and ebooks.

---

**Note**: This provider makes respectful requests to Storytel's API with appropriate delays. Please do not modify the code to remove these delays or make excessive requests.
