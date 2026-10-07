cmake_minimum_required(VERSION 3.20)
project(Synomizer VERSION 1.2.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
# Ship a standalone Windows CLI rather than requiring the Visual C++ runtime DLLs.
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS
  "${CMAKE_CURRENT_SOURCE_DIR}/data/lexicon.tsv" "${CMAKE_CURRENT_SOURCE_DIR}/data/phrases.txt"
  "${CMAKE_CURRENT_SOURCE_DIR}/data/rephrases.tsv")
file(READ "${CMAKE_CURRENT_SOURCE_DIR}/data/lexicon.tsv" LEXICON_TSV)
file(READ "${CMAKE_CURRENT_SOURCE_DIR}/data/phrases.txt" PHRASES_TXT)
file(READ "${CMAKE_CURRENT_SOURCE_DIR}/data/rephrases.tsv" REPHRASES_TSV)
if (REPHRASES_TSV MATCHES "\\)SYN")
  message(FATAL_ERROR "data/rephrases.tsv contains the raw-string delimiter )SYN")
endif()

if (LEXICON_TSV MATCHES "\\)SYN")
  message(FATAL_ERROR "data/lexicon.tsv contains the raw-string delimiter )SYN")
endif()
if (PHRASES_TXT MATCHES "\\)SYN")
  message(FATAL_ERROR "data/phrases.txt contains the raw-string delimiter )SYN")
endif()

file(MAKE_DIRECTORY "${CMAKE_BINARY_DIR}/generated")
file(WRITE "${CMAKE_BINARY_DIR}/generated/embedded_data.hpp"
"#pragma once
#include <string_view>

namespace synomizer::embedded {

inline constexpr std::string_view lexicon_tsv = R\"SYN(${LEXICON_TSV})SYN\";
inline constexpr std::string_view phrases = R\"SYN(${PHRASES_TXT})SYN\";
inline constexpr std::string_view rephrases_tsv = R\"SYN(${REPHRASES_TSV})SYN\";

}  // namespace synomizer::embedded
")

add_library(synomizer-lib STATIC
  src/lexicon.cpp
  src/english.cpp
  src/morph.cpp
  src/scan.cpp
  src/arrange.cpp
  src/substitute.cpp
  src/engine.cpp
  src/variations.cpp
  src/phrases.cpp
)
target_include_directories(synomizer-lib
  PUBLIC include
  PRIVATE src "${CMAKE_BINARY_DIR}/generated"
)
target_compile_definitions(synomizer-lib PUBLIC SYNOMIZER_VERSION="${PROJECT_VERSION}")

add_executable(synomizer src/main.cpp)
target_link_libraries(synomizer PRIVATE synomizer-lib)

if (MSVC)
  target_compile_options(synomizer-lib PRIVATE /W4 /permissive- /Zc:__cplusplus /EHsc /utf-8)
  target_compile_options(synomizer PRIVATE /W4 /permissive- /Zc:__cplusplus /EHsc /utf-8)
else()
  target_compile_options(synomizer-lib PRIVATE -Wall -Wextra -Wpedantic)
  target_compile_options(synomizer PRIVATE -Wall -Wextra -Wpedantic)
endif()

enable_testing()
add_executable(synomizer-tests tests/test_engine.cpp)
target_link_libraries(synomizer-tests PRIVATE synomizer-lib)
if (NOT MSVC)
  target_compile_options(synomizer-tests PRIVATE -Wall -Wextra -Wpedantic)
endif()
add_test(NAME engine COMMAND synomizer-tests)

if(MSVC)
  target_compile_options(synomizer-tests PRIVATE /W4 /permissive- /Zc:__cplusplus /EHsc /utf-8)
endif()
include(GNUInstallDirs)
install(TARGETS synomizer RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})
install(FILES LICENSE README.md DESTINATION ${CMAKE_INSTALL_DATADIR}/synomizer)

if(WIN32)
  target_link_libraries(synomizer PRIVATE shell32)
endif()

# The MinGW build, like MSVC, must not depend on a developer's compiler DLLs.
if(MINGW)
  target_link_options(synomizer PRIVATE -static -static-libgcc -static-libstdc++)
  target_link_options(synomizer-tests PRIVATE -static -static-libgcc -static-libstdc++)
endif()
install(FILES CHANGELOG.md DESTINATION ${CMAKE_INSTALL_DATADIR}/synomizer)
install(FILES examples/sample.txt DESTINATION ${CMAKE_INSTALL_DATADIR}/synomizer/examples)
set(CPACK_PACKAGE_NAME "Synomizer")
set(CPACK_PACKAGE_VERSION "${PROJECT_VERSION}")
set(CPACK_PACKAGE_FILE_NAME "Synomizer-${PROJECT_VERSION}-${CMAKE_SYSTEM_NAME}-${CMAKE_SYSTEM_PROCESSOR}")
set(CPACK_RESOURCE_FILE_LICENSE "${CMAKE_SOURCE_DIR}/LICENSE")
set(CPACK_GENERATOR "ZIP;TGZ")
include(CPack)

add_executable(synomizer-variation-tests tests/test_variations.cpp)
target_link_libraries(synomizer-variation-tests PRIVATE synomizer-lib)
if(MSVC)
  target_compile_options(synomizer-variation-tests PRIVATE /W4 /permissive- /Zc:__cplusplus /EHsc /utf-8)
else()
  target_compile_options(synomizer-variation-tests PRIVATE -Wall -Wextra -Wpedantic)
endif()
if(MINGW)
  target_link_options(synomizer-variation-tests PRIVATE -static -static-libgcc -static-libstdc++)
endif()
add_test(NAME variation-api COMMAND synomizer-variation-tests)
