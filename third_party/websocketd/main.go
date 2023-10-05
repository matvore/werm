// Copyright 2013 Joe Walnes and the websocketd team.
// All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"

	"libwebsocketd"
)

func logfunc(l *libwebsocketd.LogScope, level libwebsocketd.LogLevel, levelName string, category string, msg string, args ...interface{}) {
	if level < l.MinLevel {
		return
	}
	fullMsg := fmt.Sprintf(msg, args...)

	assocDump := ""
	for index, pair := range l.Associated {
		if index > 0 {
			assocDump += " "
		}
		assocDump += fmt.Sprintf("%s:'%s'", pair.Key, pair.Value)
	}

	l.Mutex.Lock()
	fmt.Printf("%s | %-6s | %-10s | %s | %s\n", libwebsocketd.Timestamp(), levelName, category, assocDump, fullMsg)
	l.Mutex.Unlock()
}

func main() {
	config := parseCommandLine()

	log := libwebsocketd.RootLogScope(config.LogLevel, logfunc)

	handler := libwebsocketd.NewWebsocketdServer(config.Config, log, config.MaxForks)
	http.Handle("/", handler)

	if config.UsingScriptDir {
		log.Info("server", "Serving from directory      : %s", config.ScriptDir)
	} else if config.CommandName != "" {
		log.Info("server", "Serving using application   : %s %s", config.CommandName, strings.Join(config.CommandArgs, " "))
	}
	if config.StaticDir != "" {
		log.Info("server", "Serving static content from : %s", config.StaticDir)
	}
	if config.CgiDir != "" {
		log.Info("server", "Serving CGI scripts from    : %s", config.CgiDir)
	}

	rejects := make(chan error, 1)

	// Serve and ServeTLS, called by the serve function below, do not return
	// except on error. Let's run serve in a go routine, reporting result to
	// control channel. This allows us to have multiple serve addresses.
	serve := func(network, address string) {
		if listener, err := net.Listen(network, address); err != nil {
			rejects <- err
		} else if config.Ssl {
			rejects <- http.ServeTLS(listener, nil, config.CertFile, config.KeyFile)
		} else {
			rejects <- http.Serve(listener, nil)
		}
	}

	for _, addrSingle := range config.Addr {
		log.Info("server", "Starting WebSocket server   : %s", handler.TellURL("ws", addrSingle, "/"))
		log.Info("server", "Serving CGI or static files : %s", handler.TellURL("http", addrSingle, "/"))
		go serve("tcp", addrSingle)

		if config.RedirPort != 0 {
			go func(addr string) {
				pos := strings.IndexByte(addr, ':')
				rediraddr := addr[:pos] + ":" + strconv.Itoa(config.RedirPort) // it would be silly to optimize this one
				redir := &http.Server{Addr: rediraddr, Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					// redirect to same hostname as in request but different port and probably schema
					uri := "https://"
					if !config.Ssl {
						uri = "http://"
					}
					if cpos := strings.IndexByte(r.Host, ':'); cpos > 0 {
						uri += r.Host[:strings.IndexByte(r.Host, ':')] + addr[pos:] + "/"
					} else {
						uri += r.Host + addr[pos:] + "/"
					}

					http.Redirect(w, r, uri, http.StatusMovedPermanently)
				})}
				log.Info("server", "Starting redirect server   : http://%s/", rediraddr)
				rejects <- redir.ListenAndServe()
			}(addrSingle)
		}
	}
	if config.Uds != "" {
		log.Info("server", "Starting WebSocket server on Unix Domain Socket: %s", config.Uds)
		go serve("unix", config.Uds)
	}
	err := <-rejects
	if err != nil {
		log.Fatal("server", "Can't start server: %s", err)
		os.Exit(3)
	}
}
