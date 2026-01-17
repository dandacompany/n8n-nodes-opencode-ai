const gulp = require('gulp');

function copyNodeIcons() {
  return gulp.src('src/nodes/**/*.{png,svg}')
    .pipe(gulp.dest('dist/nodes'));
}

function copyAssets() {
  return gulp.src('assets/**/*.{png,svg}')
    .pipe(gulp.dest('dist/assets'));
}

gulp.task('build:icons', gulp.parallel(copyNodeIcons, copyAssets));
