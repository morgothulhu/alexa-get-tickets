class UrlHelper {
    /**
     * Enforce the given URL is an absolute URL
     */
    public enforceAbsoluteUrl(url: string, baseUrl: string): string {
        if (url && !url.match(/^http(s?):\/\//)) {
            return baseUrl + url;
        } else {
            return url;
        }
    }
};

export = new UrlHelper;