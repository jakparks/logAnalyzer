var gulp = require('gulp');

// Plugins
var jshint = require('gulp-jshint');

gulp.task('jshint', function() {
	gulp.src('./public/*.js')
		.pipe(jshint())
		.pipe(jshint.reporter('default'));
});

gulp.task('default', ['jshint'], function() {
  	
});
