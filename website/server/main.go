package main

import (
	"errors"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
)

const webRoot = "/usr/share/nginx/html"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "80"
	}

	mux := http.NewServeMux()
	downloads := http.FileServer(http.Dir(webRoot))

	mux.HandleFunc("/downloads", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/downloads/", http.StatusMovedPermanently)
	})
	mux.Handle("/downloads/", downloads)
	mux.HandleFunc("/", serveSPA)

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("serving %s on %s", webRoot, server.Addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func serveSPA(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	requestedPath, err := safeJoin(webRoot, r.URL.Path)
	if err == nil {
		if info, statErr := os.Stat(requestedPath); statErr == nil {
			if info.IsDir() {
				indexPath := filepath.Join(requestedPath, "index.html")
				if indexInfo, indexErr := os.Stat(indexPath); indexErr == nil && !indexInfo.IsDir() {
					http.ServeFile(w, r, indexPath)
					return
				}
			} else {
				http.ServeFile(w, r, requestedPath)
				return
			}
		}
	}

	http.ServeFile(w, r, filepath.Join(webRoot, "index.html"))
}

func safeJoin(root, requestPath string) (string, error) {
	cleanPath := path.Clean("/" + requestPath)
	relPath := strings.TrimPrefix(cleanPath, "/")
	joinedPath := filepath.Join(root, filepath.FromSlash(relPath))

	relToRoot, err := filepath.Rel(root, joinedPath)
	if err != nil {
		return "", err
	}
	if relToRoot == ".." || strings.HasPrefix(relToRoot, ".."+string(filepath.Separator)) {
		return "", os.ErrPermission
	}

	return joinedPath, nil
}
