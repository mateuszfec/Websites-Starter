'use strict';

// GULP OPTIONS:
// --prod      | minify and clean all code
// --save      | save all temporary (build) files in assets directory
// --nostrict  | no-strict mode for JavaScript code
// --sync      | sync browser by Browsersync | Optional: --sync=http://your-proxy-to-domain.dev/
// --port      | custom port for Browsersync | Default: 3000

// Libraries
// const del = import('del');
const log = require('fancy-log');
const chokidar = require('chokidar');
const browserSync = require('browser-sync');

// Gulp libraries
const gulp = require('gulp');
const gulpIf = require('gulp-if');
const babel = require('gulp-babel');
const minify = require('gulp-minify');
const concat = require('gulp-concat');
const gulpSass = require('gulp-sass')(require('sass'));
const stripDebug = require('gulp-strip-debug');
const gulpSourcemaps = require('gulp-sourcemaps');
const autoPrefixer = require("gulp-autoprefixer");

// Globals
const isProduction = process.argv.indexOf("--prod") >= 0,
      cleanOldFiles = process.argv.indexOf("--save") < 0,
      disableStrictMode = process.argv.indexOf("--nostrict") >= 0,
      runProxy = process.argv.findIndex(value => /^--sync/.test(value)) >=0 ? process.argv.find(value => /^--sync/.test(value)) : null,
      proxyValue = runProxy !== null && runProxy.split('=')[1] ? runProxy.split('=')[1] : 'http://localhost/',
      host = proxyValue.replace(/(http:\/\/)|(https:\/\/)/gm, '').split('/')[0] || 'localhost',
      portParameter = process.argv.findIndex(value => /^--port/.test(value)) >=0 ? process.argv.find(value => /^--port/.test(value)) : null,
      portValue = portParameter !== null && portParameter.split('=')[1] ? portParameter.split('=')[1] : 3000,
      logs = process.argv.indexOf("--log2") > 0 ? 2 : process.argv.indexOf("--log1") > 0 ? 1 : 0,
      variant = 'project',
      browserSyncOptions = {
          watch: true,
          watchOptions: {
              ignoreInitial: true
          },
          files: ['assets/**/*', '**/*.php', '**/*.html'],
          open: false,
          https: true
      };

// JS libraries to build by Gulp
const jsLibraries = [
    './dev/js/**/*',
    '!./dev/js/*.js'
];

if (runProxy){
    browserSyncOptions.host = host;
    browserSyncOptions.proxy = proxyValue;
    browserSyncOptions.port = portValue || 3000;
}

function watch(){
    const stylesWatcher = chokidar.watch([`./dev/sass/**/*.scss`, `./dev/css/**/*.css`]);
    const jsWatcher = chokidar.watch([`./dev/js/**/*.js`]);
    const assetsWatcher = chokidar.watch([`./dev/images/**/*`, `./dev/fonts/**/*`]);

    if (runProxy) browserSync.init(browserSyncOptions);

    stylesWatcher.on('ready', async () => {
        log.info("Starting - Initial build...");
        await cleanAll();
        await fonts();
        await images();
        await stylesCompiler();
        await javaScript();
        await javaScriptLibraries();
        await runBrowserSync();
        log.info("Finished - Waiting for changes...");
    });

    stylesWatcher.on('change', async () => {
        log.info("Starting - Styles compiler...");
        await cleanStyles();
        await stylesCompiler();
        await runBrowserSync();
        log.info("Finished - Waiting for changes...");
    });

    jsWatcher.on('change', async ()=>{
        log.info("Starting - JS compiler...");
        await cleanJavaScript();
        await javaScript();
        await javaScriptLibraries();
        await runBrowserSync();
        log.info("Finished - Waiting for changes...");
    });

    assetsWatcher.on('change', async ()=>{
        log.info("Starting - ASSETS (images + fonts) compiler...");
        await fonts();
        await images();
        await runBrowserSync();
        log.info("Finished - Waiting for changes...");
    });
}

async function stylesCompiler() {
    sassCompiler();

    if (logs >= 1) log("Finished - All variants are concatenated successfully");

    // if (cleanOldFiles){
    //     await del([`./assets/styles`]);
    //     if (logs >= 2) log("Finished - All temporary files are deleted successfully");
    // }

    if (logs >= 1) log("Finished - All CSS files are created successfully");
}

async function runBrowserSync(){
    if (runProxy){
        return await new Promise((resolve, reject) => {
            gulp.src('*')
                .pipe(browserSync.stream())
                .on("error", (err) => { reject(err) })
                .on("finish", ()=>{
                    if (logs >= 2) log(`Finished - Browsersync finished`);
                    resolve(true);
                });
        });
    } else return Promise.resolve();
}

function sassCompiler(){
    return new Promise((resolve, reject) => {
        gulp.src(`./dev/sass/${variant}.scss`)
            .pipe(gulpIf(!isProduction, gulpSourcemaps.init({loadMaps: true})))
                .pipe(gulpSass().on('error', gulpSass.logError))
                .pipe(autoPrefixer({
                    cascade: false,
                    remove: false
                }))
                .pipe(concat(`${variant}-wscss-sass.css`))
            .pipe(gulpIf(!isProduction, gulpSourcemaps.write('.')))
            .pipe(gulp.dest(`./assets/styles/${variant}`))
            .on("error", (err) => { reject(err) })
            .on("finish", ()=>{
                if (logs >= 2 && variant) {
                    log(`Finished - SASS > [${variant}] variant compiled successfully`);
                } else if (logs >= 2) {
                    log(`Finished - SASS files are compiled successfully`);
                }
                resolve(true);
            });
    });
}

function javaScript() {
    return new Promise((resolve, reject) => {
        gulp.src(['./dev/js/*.js', '!./dev/js/**/*.min.js'])
            .pipe(gulpIf(!isProduction, gulpSourcemaps.init({loadMaps: true})))
                .pipe(gulpIf(isProduction, stripDebug()))
                .pipe(gulpIf(!disableStrictMode, babel()))
                .pipe(minify({
                    noSource: true,
                    ext: {min: '.min.js'}
                }))
            .pipe(gulpIf(!isProduction, gulpSourcemaps.write('.')))
            .pipe(gulp.dest('./assets/js'))
            .on("error", (err) => { reject(err) })
            .on("finish", ()=>{
                if (logs >= 1) log("Finished - All JS files are compiled successfully");
                resolve(true);
            });
    });
}

function javaScriptLibraries() {
    if (jsLibraries && jsLibraries.length > 0){
        return new Promise((resolve, reject) => {
            gulp.src(jsLibraries)
                .pipe(gulpIf(!isProduction, gulpSourcemaps.init({loadMaps: true})))
                .pipe(gulpIf(!isProduction, gulpSourcemaps.write('.')))
                .pipe(gulp.dest('./assets/js'))
                .on("error", (err) => { reject(err) })
                .on("finish", ()=>{
                    if (logs >= 1) log("Finished - All JS libraries files are copied successfully");
                    resolve(true);
                });
        });
    } else return Promise.resolve();
}

function fonts(){
    return new Promise((resolve, reject) => {
        gulp.src(`./dev/fonts/**/*`)
            .pipe(gulp.dest(`./assets/fonts`))
            .on("error", (err) => { reject(err) })
            .on("finish", ()=>{
                if (logs >= 1) log("Finished - All FONTS are copied successfully");
                resolve(true);
            });
    });
}

function images(){
    return new Promise((resolve, reject) => {
        gulp.src(`./dev/images/**/*`)
            .pipe(gulp.dest(`./assets/images`))
            .on("error", (err) => { reject(err) })
            .on("finish", ()=>{
                if (logs >= 1) log("Finished - All IMAGES are copied successfully");
                resolve(true);
            });
    });
}

function cleanAll() {
    if (cleanOldFiles){
        // return del([`./assets`]);
        return Promise.resolve();
    } else {
        return Promise.resolve();
    }
}

function cleanStyles() {
    if (cleanOldFiles){
        // return del([`./assets/styles`, `./assets/css`]);
        return Promise.resolve();
    } else {
        return Promise.resolve();
    }
}

function cleanJavaScript(){
    if (cleanOldFiles){
        // return del([`./assets/js`]);
        return Promise.resolve();
    } else {
        return Promise.resolve();
    }
}

exports.watch = watch;
exports.build = gulp.series(cleanAll, images, fonts, stylesCompiler, javaScript, javaScriptLibraries);
exports.clean = cleanAll;
exports.assets = gulp.series(images, fonts);
exports.styles = gulp.series(cleanStyles, stylesCompiler);
exports.js = gulp.series(cleanJavaScript, javaScript, javaScriptLibraries);
