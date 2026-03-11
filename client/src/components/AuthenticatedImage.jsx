import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function AuthenticatedImage({ src, alt, className, fallbackText = 'Image Not Found' }) {
    const [imageUrl, setImageUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!src) {
            setImageUrl(null);
            return;
        }

        // If it's already a blob or absolute external URL that doesn't need auth, just use it
        if (src.startsWith('blob:') || src.startsWith('data:')) {
            setImageUrl(src);
            return;
        }

        let isMounted = true;
        setLoading(true);
        setError(false);

        // Strip baseURL if present to use the axios instance correctly
        let fetchUrl = src;
        const baseUrl = api.defaults.baseURL || 'http://localhost:3000';
        if (fetchUrl.startsWith(baseUrl)) {
            fetchUrl = fetchUrl.substring(baseUrl.length);
        }
        if (!fetchUrl.startsWith('/')) {
            fetchUrl = '/' + fetchUrl;
        }

        api.get(fetchUrl, { responseType: 'blob' })
            .then(response => {
                if (isMounted) {
                    setImageUrl(URL.createObjectURL(response.data));
                }
            })
            .catch(err => {
                console.error("Failed to fetch image securely", err);
                if (isMounted) setError(true);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [src]);

    // Cleanup object URL on unmount or URL change
    useEffect(() => {
        return () => {
            if (imageUrl && imageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [imageUrl]);

    if (loading) {
        return (
            <div className={`flex items-center justify-center bg-slate-900 border border-slate-800 text-muted-foreground animate-pulse text-sm ${className}`}>
                Loading secure image...
            </div>
        );
    }

    if (error || !imageUrl) {
        return (
            <div className={`flex flex-col items-center justify-center bg-slate-900 border border-slate-800 p-8 ${className}`}>
                <p className="text-muted-foreground font-medium">{fallbackText}</p>
                <p className="text-xs text-slate-500 mt-2">The image may have been deleted or never uploaded.</p>
            </div>
        );
    }

    return (
        <img
            src={imageUrl}
            alt={alt}
            className={className}
        />
    );
}
