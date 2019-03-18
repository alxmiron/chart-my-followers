const sass = require('node-sass');

module.exports = function(grunt) {
  require('load-grunt-tasks')(grunt);

  var PRODUCTION = process.env.NODE_ENV == 'production';

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    browserify: {
      build: {
        files: {
          'dist/js/bundle.js': ['src/app.js'],
        },
        options: {
          browserifyOptions: {
            debug: !PRODUCTION,
          },
        },
      },
    },

    sass: {
      options: {
        implementation: sass,
        sourceMap: true,
      },
      dist: {
        files: {
          'dist/css/bundle.css': ['src/styles/main.scss'],
        },
      },
    },

    jade: {
      compile: {
        options: {
          pretty: !PRODUCTION,
        },
        files: {
          'dist/index.html': ['src/views/index.jade'],
        },
      },
    },

    watch: {
      grunt: {
        files: ['Gruntfile.js'],
      },
      jade: {
        files: ['src/views/*.jade'],
        tasks: ['jade'],
      },
      sass: {
        files: ['src/styles/*.scss'],
        tasks: ['sass'],
      },
      browserify: {
        files: ['src/*.js'],
        tasks: ['browserify'],
      },
    },

    copy: {
      assets: {
        expand: true,
        cwd: './src/assets',
        src: ['./*'],
        dest: 'dist/',
      },
    },

    uglify: {
      options: {
        manage: false,
      },
      uglify: {
        files: [
          {
            'dist/js/bundle.js': ['dist/js/bundle.js'],
          },
        ],
      },
    },

    cssmin: {
      minify: {
        files: [
          {
            expand: true,
            cwd: 'dist/css/',
            src: '*.css',
            dest: 'dist/css',
            ext: '.css',
          },
        ],
      },
    },

    browserSync: {
      bsFiles: {
        src: ['dist/*.html'],
      },
      options: {
        watchTask: true,
        server: {
          baseDir: './dist',
        },
      },
    },

    clean: {
      build: ['./dist/'],
      options: {
        force: true,
      },
    },
  });

  var buildTasks = ['clean', 'copy', 'jade', 'sass', 'browserify', PRODUCTION && 'minimize'].filter(Boolean);

  grunt.registerTask('minimize', ['uglify', 'cssmin']);
  grunt.registerTask('build', buildTasks);
  grunt.registerTask('default', ['build', 'browserSync', 'watch']);
  grunt.task.run('notify_hooks');
};
